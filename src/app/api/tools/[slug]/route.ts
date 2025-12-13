import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ToolPreset = { label: string; input: string };

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

function buildClarifySystemPrompt(config: ToolConfig) {
  const clarify = safeStr(config.clarifyPrompt).trim();

  // If tool didn't provide clarifyPrompt, use a strong default that fits your platform
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

  return clarify.length ? clarify : defaultClarify;
}

function buildFinalizeSystemPrompt(config: ToolConfig, outputFormat: "plain" | "json") {
  const base = safeStr(config.systemPrompt).trim();
  const finalizeAddon = safeStr(config.finalizePrompt).trim();

  // If structured-output is requested, force JSON
  const structuredAddon =
    outputFormat === "json"
      ? `
IMPORTANT OUTPUT RULE:
- Output MUST be valid JSON only (no markdown, no extra commentary).
- Follow this schema hint if provided: ${safeStr(config.jsonSchemaHint).trim() || "(no hint)"}.
- If uncertain or missing information, use null/empty fields rather than inventing facts.
`
      : "";

  // If tool provided finalizePrompt, append it (it should tell model how to use answers)
  const finalizeBlock = finalizeAddon
    ? `
FINALIZE INSTRUCTIONS:
${finalizeAddon}
`
    : "";

  return [base, finalizeBlock, structuredAddon].filter(Boolean).join("\n\n").trim();
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;

    const body = await req.json().catch(() => ({} as any));

    const input = safeStr(body?.input);
    const mode = safeStr(body?.mode); // "simple" | "auto" (from ToolClient)
    const outputFormat = asOutputFormat(body?.outputFormat);
    const answers = Array.isArray(body?.answers) ? body.answers : null;

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
    const effectiveOutputFormat = supportsStructured ? outputFormat : "plain";

    // Decide if we run clarify-first:
    // - only if tool supports it
    // - only if client asked for auto mode
    // - Step B occurs when body.answers is provided
    const useClarify = supportsClarify && mode === "auto";

    // -------------------------
    // STEP A: Clarify
    // -------------------------
    if (useClarify && !answers) {
      const clarifySystem = buildClarifySystemPrompt(config);

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
        // If model didn't return JSON, do a quick repair attempt
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

      // If no clarification needed, fall through to final generation
      if (needClarification && questions.length > 0) {
        return NextResponse.json({
          step: "clarify" as Step,
          questions,
        });
      }
      // else continue to final (below)
    }

    // -------------------------
    // STEP B (or normal): Final generation
    // -------------------------
    const finalSystem = buildFinalizeSystemPrompt(config, effectiveOutputFormat);

    // If answers are provided, include them in the user content
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

    // If structured output required, enforce valid JSON
    if (effectiveOutputFormat === "json") {
      if (!isJsonValid(output)) {
        const repaired = await repairJson({
          badJson: output,
          schemaHint: safeStr(config.jsonSchemaHint).trim(),
        });
        output = stripCodeFences(repaired);

        // If STILL not valid, return a 500 so you notice quickly
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
