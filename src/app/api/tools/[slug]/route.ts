import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Backwards compatible:
 * - Old: { label, input }
 * - New: { label, prompt, hint? }
 */
type ToolPreset =
  | { label: string; input: string }
  | { label: string; prompt: string; hint?: string };

type AtlasBuildStep = {
  id: string;
  title: string;
  promptTemplate: string;
};

type AtlasBuildPlan = {
  level?: "micro-tool" | "multi-page-app" | string;
  idea?: any;
  blueprint?: any;
  expanded?: any;
  nextPrompts?: AtlasBuildStep[];
};

type ToolConfig = {
  slug: string;
  title: string;
  description: string;
  inputLabel: string;
  outputLabel: string;
  systemPrompt: string;
  temperature?: number;

  features?: string[];

  // optional, based on features
  presets?: ToolPreset[];
  outputFormatDefault?: "plain" | "json";
  jsonSchemaHint?: string;

  clarifyPrompt?: string;
  finalizePrompt?: string;

  // ✅ NEW: optional build plan
  atlasBuildPlan?: AtlasBuildPlan;
};

type Step = "final" | "clarify";

function safeStr(x: any) {
  return typeof x === "string" ? x : "";
}

function stripCodeFences(raw: string) {
  return (raw || "").trim().replace(/```json/gi, "").replace(/```/g, "").trim();
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function asOutputFormat(x: any): "plain" | "json" {
  return x === "json" ? "json" : "plain";
}

function isJsonValid(s: string) {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}

function buildFocusBlock({
  focusLabel,
  focusPrompt,
}: {
  focusLabel?: string;
  focusPrompt?: string;
}) {
  const label = safeStr(focusLabel).trim();
  const prompt = safeStr(focusPrompt).trim();

  if (!label && !prompt) return "";

  return `
FOCUS LENS (apply this lens to the behavior and evaluation criteria):
Label: ${label || "(none)"}
Instructions:
${prompt || "- Use the label as light guidance if no prompt was provided."}
`.trim();
}

/**
 * Attempts to coerce model output to valid JSON.
 * We keep it simple: if it's not valid, we run one repair attempt.
 */
async function repairJson({
  badJson,
  schemaHint,
}: {
  badJson: string;
  schemaHint?: string;
}) {
  const repairSystem = `
You are a JSON repair function.

Rules:
- Output ONLY valid JSON.
- Do not include markdown fences.
- Do not add commentary.
- If information is missing, use null or empty strings/arrays rather than inventing facts.
`.trim();

  const repairUser = `
The following should be valid JSON but is not. Repair it.

JSON_SCHEMA_HINT (optional):
${schemaHint || "(none)"}

BROKEN_JSON:
${badJson}
`.trim();

  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: repairSystem },
      { role: "user", content: repairUser },
    ],
    temperature: 0,
  });

  return stripCodeFences(completion.choices[0]?.message?.content ?? "");
}

function buildClarifySystemPrompt(config: ToolConfig, focusBlock: string) {
  const clarify = safeStr(config.clarifyPrompt).trim();

  const defaultClarify = `
You are Atlas in "clarify-first" mode.

Task:
- Read the user's input and decide what MUST be clarified before producing the final artifact.

Output:
Return ONLY strict JSON in this shape:
{
  "needClarification": boolean,
  "questions": string[]
}

Rules:
- Ask 2–6 questions max.
- Questions must be short, practical, and directly unblock the output.
- If you have enough info, set needClarification=false and questions=[].
- Do NOT generate the final artifact here.
- Do NOT invent facts.
`.trim();

  return [clarify.length ? clarify : defaultClarify, focusBlock]
    .filter(Boolean)
    .join("\n\n---\n\n")
    .trim();
}

function buildFinalizeSystemPrompt(
  config: ToolConfig,
  outputFormat: "plain" | "json",
  focusBlock: string
) {
  const base = safeStr(config.systemPrompt).trim();
  const finalizeAddon = safeStr(config.finalizePrompt).trim();

  const structuredAddon =
    outputFormat === "json"
      ? `
IMPORTANT OUTPUT RULE:
- Output MUST be valid JSON only (no markdown, no extra commentary).
- Follow this schema hint if provided: ${safeStr(config.jsonSchemaHint).trim() || "(no hint)"}.
- If uncertain or missing information, use null/empty fields rather than inventing facts.
`
      : "";

  const finalizeBlock = finalizeAddon
    ? `
FINALIZE INSTRUCTIONS:
${finalizeAddon}
`
    : "";

  return [base, focusBlock, finalizeBlock, structuredAddon]
    .filter(Boolean)
    .join("\n\n---\n\n")
    .trim();
}

function buildBuildSystemPrompt(opts: {
  config: ToolConfig;
  focusBlock: string;
  outputFormat: "plain" | "json";
  buildStepId?: string;
  buildPrompt?: string;
}) {
  const { config, focusBlock, outputFormat, buildStepId, buildPrompt } = opts;

  // In build-mode we want engineering-grade, incremental artifacts.
  // Default to JSON to enable machine-like chaining.
  const buildCore = `
You are Atlas Build Engine.

Goal:
- Turn a high-level idea into real software by working top-down.
- Produce incremental, structured build artifacts that can be executed or implemented.

Rules:
- Be specific and technical. Prefer concrete files, routes, DB tables, and logic.
- Do NOT invent external project files that were not requested; instead propose them explicitly.
- Keep changes incremental: output the smallest useful set of deliverables for this step.
- If something is ambiguous, include 1–3 "openQuestions" fields instead of guessing.

Output requirement:
${
  outputFormat === "json"
    ? `- Output ONLY valid JSON. No markdown.
- Use the schema below exactly.`
    : `- Output plain text. Use headings and bullet points.`
}

JSON schema (if JSON output):
{
  "stepId": string,
  "title": string,
  "summary": string,
  "assumptions": string[],
  "openQuestions": string[],
  "deliverables": [
    {
      "type": "files" | "db" | "routes" | "prompts" | "plan",
      "items": any[]
    }
  ],
  "nextSteps": [
    { "id": string, "title": string, "prompt": string }
  ]
}

Deliverable conventions:
- If delivering code, include objects like:
  { "path": "src/...", "purpose": "...", "content": "FULL FILE CONTENT" }
- If delivering DB changes, include:
  { "model": "...", "change": "...", "migrationNotes": "..." }
- If delivering route contracts, include:
  { "method": "POST", "path": "/api/...", "request": {...}, "response": {...} }

Step context:
- buildStepId: ${safeStr(buildStepId) || "(none)"}
- buildPrompt (instructions): ${safeStr(buildPrompt) ? "provided" : "not provided"}
`.trim();

  // Tie in the tool’s base identity, but build-mode overrides tone/format.
  const baseIdentity = safeStr(config.systemPrompt).trim();

  const buildPromptBlock = safeStr(buildPrompt).trim()
    ? `
BUILD STEP INSTRUCTIONS:
${safeStr(buildPrompt).trim()}
`.trim()
    : "";

  return [buildCore, focusBlock, buildPromptBlock, baseIdentity]
    .filter(Boolean)
    .join("\n\n---\n\n")
    .trim();
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;

    const body = await req.json().catch(() => ({} as any));

    const input = safeStr(body?.input);
    const mode = safeStr(body?.mode); // "simple" | "auto" | "build"
    const outputFormat = asOutputFormat(body?.outputFormat);
    const answers = Array.isArray(body?.answers) ? body.answers : null;

    // NEW: build step support
    const buildStepId = safeStr(body?.buildStepId);
    const buildPrompt = safeStr(body?.buildPrompt);

    // NEW: focus lens
    const focusLabel = safeStr(body?.focusLabel);
    const focusPrompt = safeStr(body?.focusPrompt);
    const focusBlock = buildFocusBlock({ focusLabel, focusPrompt });

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY missing on server" },
        { status: 500 }
      );
    }

    if (!input || typeof input !== "string") {
      return NextResponse.json(
        { error: "Missing 'input' string in request body" },
        { status: 400 }
      );
    }

    const configPath = path.join(process.cwd(), "tool-configs", `${slug}.json`);

    if (!fs.existsSync(configPath)) {
      return NextResponse.json(
        { error: `Tool config not found for slug: ${slug}` },
        { status: 404 }
      );
    }

    const raw = fs.readFileSync(configPath, "utf-8");
    const config: ToolConfig = JSON.parse(raw);

    const features = Array.isArray(config.features) ? config.features : [];
    const supportsClarify = features.includes("clarify-first");
    const supportsStructured = features.includes("structured-output");

    // If tool doesn't support structured output, force plain.
    // BUT: build-mode should still be allowed to use JSON even if the tool didn't declare structured-output
    // because "Build mode" is platform-level behavior.
    const isBuildMode = mode === "build";
    const effectiveOutputFormat =
      isBuildMode ? (outputFormat || "json") : supportsStructured ? outputFormat : "plain";

    // Decide if we run clarify-first:
    const useClarify = supportsClarify && mode === "auto" && !isBuildMode;

    // -------------------------
    // BUILD MODE (top-down step execution)
    // -------------------------
    if (isBuildMode) {
      const system = buildBuildSystemPrompt({
        config,
        focusBlock,
        outputFormat: effectiveOutputFormat,
        buildStepId,
        buildPrompt,
      });

      const completion = await client.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: input },
        ],
        temperature: clamp(Number(config.temperature ?? 0.35), 0, 1),
      });

      let output = stripCodeFences(completion.choices[0]?.message?.content ?? "");

      if (effectiveOutputFormat === "json") {
        if (!isJsonValid(output)) {
          const repaired = await repairJson({
            badJson: output,
            schemaHint: `{
  "stepId": string,
  "title": string,
  "summary": string,
  "assumptions": string[],
  "openQuestions": string[],
  "deliverables": [{"type": "files"|"db"|"routes"|"prompts"|"plan", "items": any[]}],
  "nextSteps": [{"id": string, "title": string, "prompt": string}]
}`,
          });
          output = stripCodeFences(repaired);

          if (!isJsonValid(output)) {
            return NextResponse.json(
              {
                error: "Build mode returned invalid JSON and repair failed",
                details: output.slice(0, 800),
              },
              { status: 500 }
            );
          }
        }
      }

      return NextResponse.json({
        step: "final" as Step,
        output,
        outputFormat: effectiveOutputFormat,
      });
    }

    // -------------------------
    // STEP A: Clarify
    // -------------------------
    if (useClarify && !answers) {
      const clarifySystem = buildClarifySystemPrompt(config, focusBlock);

      const completion = await client.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: clarifySystem },
          { role: "user", content: input },
        ],
        temperature: 0.2,
      });

      let rawOut = stripCodeFences(completion.choices[0]?.message?.content ?? "");

      let parsed: any = null;
      try {
        parsed = JSON.parse(rawOut);
      } catch {
        const repaired = await repairJson({
          badJson: rawOut,
          schemaHint: `{"needClarification": boolean, "questions": string[]}`,
        });
        try {
          parsed = JSON.parse(repaired);
        } catch {
          parsed = { needClarification: false, questions: [] };
        }
      }

      const needClarification = !!parsed?.needClarification;
      const questions: string[] = Array.isArray(parsed?.questions)
        ? parsed.questions.map((q: any) => String(q)).slice(0, 6)
        : [];

      if (needClarification && questions.length > 0) {
        return NextResponse.json({
          step: "clarify" as Step,
          questions,
          outputFormat: effectiveOutputFormat,
        });
      }
      // else continue to final
    }

    // -------------------------
    // STEP B (or normal): Final generation
    // -------------------------
    const finalSystem = buildFinalizeSystemPrompt(
      config,
      effectiveOutputFormat,
      focusBlock
    );

    const userContent = answers
      ? `
USER INPUT:
${input}

CLARIFY ANSWERS (treat as truth; do not invent):
${answers.map((a: any, i: number) => `Q${i + 1}: ${String(a)}`).join("\n")}
`.trim()
      : input;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: finalSystem },
        { role: "user", content: userContent },
      ],
      temperature: clamp(Number(config.temperature ?? 0.4), 0, 1),
    });

    let output = completion.choices[0]?.message?.content ?? "";
    output = stripCodeFences(output);

    if (effectiveOutputFormat === "json") {
      if (!isJsonValid(output)) {
        const repaired = await repairJson({
          badJson: output,
          schemaHint: safeStr(config.jsonSchemaHint).trim(),
        });
        output = stripCodeFences(repaired);

        if (!isJsonValid(output)) {
          return NextResponse.json(
            {
              error: "Model returned invalid JSON and repair failed",
              details: output.slice(0, 800),
            },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({
      step: "final" as Step,
      output,
      outputFormat: effectiveOutputFormat,
    });
  } catch (err: any) {
    console.error("[API] error:", err);
    return NextResponse.json(
      { error: "Server error", details: err.message || String(err) },
      { status: 500 }
    );
  }
}
