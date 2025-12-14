import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.OPENAI_API_KEY) {
  console.error(
    "ERROR: OPENAI_API_KEY is not set. Make sure the environment variable is defined (e.g., GitHub Actions secret named OPENAI_API_KEY)."
  );
  process.exit(1);
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * AVAILABLE FEATURES
 * ------------------
 * Keep extending this list over time.
 *
 * v1 upgrades:
 * - presets: refinement lenses (NOT example-fill) to help users get better results faster
 * - structured-output: tool can request output in "plain" or "json"
 * - clarify-first: two-step flow (ask questions, then finalize)
 * - saved-history: store recent runs (start client-side/localStorage)
 */
const AVAILABLE_FEATURES = [
  "text-input",
  "file-upload",
  "presets",
  "structured-output",
  "clarify-first",
  "saved-history",
];

// Default refinement lenses (generic, non-scenario, always useful)
const DEFAULT_LENSES = [
  {
    label: "Make it clearer",
    prompt:
      "Rewrite/produce the output with maximum clarity. Reduce ambiguity, define terms briefly, and avoid jargon unless necessary.",
    hint: "Improve clarity",
  },
  {
    label: "More structured",
    prompt:
      "Use a clean structure with headings and bullet points. Make the output scannable and logically ordered.",
    hint: "Add structure",
  },
  {
    label: "More critical",
    prompt:
      "Be more rigorous. Identify weak spots, missing assumptions, contradictions, and any risks or limitations.",
    hint: "Pressure-test",
  },
  {
    label: "More actionable",
    prompt:
      "Add concrete next steps, checklists, or recommendations. Prioritize what to do first and why.",
    hint: "Make it usable",
  },
  {
    label: "Shorter",
    prompt:
      "Keep the output concise. Remove filler, keep only the highest-signal information, and use tight language.",
    hint: "Concise",
  },
];

// Labels that are too scenario-specific (we reject these)
function isTooSpecificPresetLabel(label) {
  const s = String(label || "").toLowerCase();
  return (
    /manuscript|paper|psychology|biology|social science|case study|example|notes on a|poster on|clinical|patient|contract|lawsuit|tax return|resume for/i.test(
      s
    ) ||
    s.length > 60
  );
}

const RUBRIC = `
You are an expert product designer and idea generator for small, one-page AI tools.

Your goal: generate tools that are:
- truly useful in a specific real-world workflow
- genuinely original (not prompt-wrapper clones)
- niche-dominant (ideally the only tool someone would search for in that exact situation)

HARD CONSTRAINTS (must follow):
- Each tool must be usable as a single-page web app.
- Input is plain text (textarea) and/or text extracted from uploaded files.
- Output is plain text (but may also be valid JSON if "structured-output" is enabled).
- Target a specific niche (role + scenario), not a broad audience.
- Must be actually useful, not a joke.
- Avoid: medical diagnosis, legal advice, unsafe content, or instructions enabling wrongdoing.
- The niche AND use-case must be clearly different from existing tools:
  - No overlapping user role AND overlapping input text type AND overlapping output purpose.
  - Superficial rewording or swapping job titles does NOT count as different.

AVAILABLE FEATURES (capabilities you can choose from for each tool):

1) "text-input"
   - User can type or paste freeform text into a textarea.
   - Most tools should include this.

2) "file-upload"
   - User can upload one or more text-based files.
   - The app will read the text content and feed it to the AI alongside any typed input.
   - Only include if core value depends on analyzing documents.

3) "presets"
   - Provide 2–6 clickable REFINEMENT LENSES that DO NOT fill the input box.
   - Each preset has: {label, prompt, hint?}
   - The "prompt" is a short instruction that refines evaluation criteria or output style.
   - Labels MUST be generic (e.g., "Make it clearer", "More structured", "More critical", "More actionable", "Shorter").
   - DO NOT include scenario/example labels like "Review notes on a psychology manuscript".

4) "structured-output"
   - The tool may request output format: "plain" or "json".
   - If "json", output MUST be valid JSON (no markdown fences) that matches a small schema you define.
   - This makes outputs more machine-usable later.

5) "clarify-first"
   - Two-step flow:
     Step 1: Ask up to 3 clarifying questions if key info is missing.
     Step 2: Produce the final artifact using the user's answers.
   - The tool config should include a short "clarifyPrompt" describing what questions to ask.

6) "saved-history"
   - The client stores the last ~10 runs per tool (input + output + timestamp).
   - This makes tools feel professional and sticky. Use this frequently.

SCALING & COMPLEXITY GUIDELINES:
- Prefer tools that combine 2–4 features in a meaningful way.
- Single-feature tools should be rare (10–20%).
- With this feature set, many good tools should combine:
  ["text-input","presets"] OR ["text-input","file-upload","presets"]
- Use "clarify-first" for workflows with missing/variable info.
- Use "structured-output" when the output is an artifact that could be parsed (checklists, KPI tables, risk flags, mappings).
- Use "saved-history" for tools people will run repeatedly.

IMPORTANT FEATURE RULES:
- Every tool MUST include a "features" array listing which features it uses.
- "features" may only contain feature names from the list above.
- If using "structured-output", include an "outputFormatDefault": "plain" or "json".
- If using "structured-output" with "json", include a "jsonSchemaHint" describing keys (in plain English).
- If using "presets", include a "presets" array (2–6 items) with {label, prompt, hint?}.
- If using "clarify-first", include a "clarifyPrompt" (what to ask) and "finalizePrompt" (how to produce final output).

SYSTEM PROMPT QUALITY BAR:
- Clearly state niche user + exact artifact produced.
- Enforce structure and constraints.
- Include 3–6 hard rules.
- Refuse disallowed requests.

SLUG RULES:
- kebab-case, lowercase, hyphens only.
- unique vs existing tools.

TEMPERATURE:
- 0.3–0.5 for structured/precision
- 0.6–0.8 for creative-but-controlled

Return ONLY strict JSON with this exact shape:

{
  "slug": string,
  "title": string,
  "description": string,
  "inputLabel": string,
  "outputLabel": string,
  "systemPrompt": string,
  "temperature": number,
  "features": string[],

  // optional, only if feature enabled:
  "presets"?: [{"label": string, "prompt": string, "hint"?: string}],
  "outputFormatDefault"?: "plain" | "json",
  "jsonSchemaHint"?: string,

  "clarifyPrompt"?: string,
  "finalizePrompt"?: string
}
`;

// ---- helpers to read existing tools ----
function loadExistingTools() {
  const rootDir = path.join(__dirname, "..");
  const configDir = path.join(rootDir, "tool-configs");

  if (!fs.existsSync(configDir)) return [];

  const files = fs.readdirSync(configDir).filter((f) => f.endsWith(".json"));

  const tools = files
    .map((file) => {
      const filePath = path.join(configDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      try {
        const json = JSON.parse(content);
        return { slug: json.slug, title: json.title, description: json.description };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return tools;
}

// ---- OpenAI call ----
async function generateToolConfig(existingTools) {
  const existingSummary =
    existingTools.length === 0
      ? "There are currently no existing tools."
      : "Existing tools:\n" +
        existingTools
          .map((t) => `- slug: ${t.slug}, title: ${t.title}, description: ${t.description}`)
          .join("\n");

  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: RUBRIC },
      {
        role: "user",
        content:
          existingSummary +
          "\n\nYou have access to these features: " +
          AVAILABLE_FEATURES.join(", ") +
          ".\n\n" +
          "Generate ONE new tool config JSON now for a niche that is clearly different from ALL of the above. " +
          "Avoid overlapping the same user role or type of input text.\n\n" +
          "Prefer combining multiple features meaningfully (e.g., presets + structured-output, or file-upload + presets). " +
          "Use clarify-first when the workflow often has missing info.\n\n" +
          'If you include "presets", they MUST be refinement lenses (label + prompt + optional hint), not example inputs. ' +
          "Labels MUST be generic (no domain examples).",
      },
    ],
    temperature: 0.7,
  });

  let raw = completion.choices[0]?.message?.content ?? "";
  raw = raw.trim().replace(/```json/g, "").replace(/```/g, "");

  const config = JSON.parse(raw);

  // --- Safety: normalize / validate features ---
  let features = config.features;
  if (!Array.isArray(features)) features = ["text-input"];
  features = features.filter((f) => AVAILABLE_FEATURES.includes(f));
  if (features.length === 0) features = ["text-input"];

  // ---- normalize optional fields based on features ----
  let presets = config.presets;

  if (features.includes("presets")) {
    if (!Array.isArray(presets)) presets = [];

    presets = presets
      .slice(0, 6)
      .map((p) => {
        const label =
          typeof p?.label === "string" ? p.label.trim().slice(0, 60) : "Refine";

        // Preferred: lens preset
        if (typeof p?.prompt === "string" && p.prompt.trim()) {
          return {
            label,
            prompt: p.prompt.trim().slice(0, 1200),
            hint: typeof p?.hint === "string" ? p.hint.trim().slice(0, 160) : undefined,
          };
        }

        // Back-compat: if model returns {input}, convert to a lens prompt
        if (typeof p?.input === "string" && p.input.trim()) {
          const input = p.input.trim().slice(0, 400);
          return {
            label,
            prompt: `Use this lens while generating: ${input}`.slice(0, 1200),
            hint: "Refinement lens (converted from legacy preset)",
          };
        }

        return null;
      })
      .filter(Boolean);

    // De-specificity guard: if any label looks scenario-like, replace with defaults
    if (presets.length && presets.some((p) => isTooSpecificPresetLabel(p.label))) {
      presets = DEFAULT_LENSES.slice(0, 4);
    }

    // If model forgot presets, use strong generic defaults
    if (presets.length < 2) {
      presets = DEFAULT_LENSES.slice(0, 4);
    }
  } else {
    presets = undefined;
  }

  let outputFormatDefault = config.outputFormatDefault;
  let jsonSchemaHint = config.jsonSchemaHint;

  if (features.includes("structured-output")) {
    if (outputFormatDefault !== "json" && outputFormatDefault !== "plain") {
      outputFormatDefault = "plain";
    }
    if (typeof jsonSchemaHint !== "string") jsonSchemaHint = "";
  } else {
    outputFormatDefault = undefined;
    jsonSchemaHint = undefined;
  }

  let clarifyPrompt = config.clarifyPrompt;
  let finalizePrompt = config.finalizePrompt;

  if (features.includes("clarify-first")) {
    if (typeof clarifyPrompt !== "string" || clarifyPrompt.trim().length < 20) {
      clarifyPrompt =
        "Ask up to 3 clarifying questions needed to produce a correct, usable output. If nothing is missing, ask zero questions.";
    }
    if (typeof finalizePrompt !== "string" || finalizePrompt.trim().length < 20) {
      finalizePrompt =
        "Using the user's answers (if any), produce the final artifact with strict structure and no invented facts.";
    }
  } else {
    clarifyPrompt = undefined;
    finalizePrompt = undefined;
  }

  return {
    ...config,
    features,
    presets,
    outputFormatDefault,
    jsonSchemaHint,
    clarifyPrompt,
    finalizePrompt,
  };
}

/**
 * Decide if a config is "too simple" given the global feature set.
 * With 6 features, we should discourage ["text-input"] only.
 */
function isTooSimple(config) {
  const feats = config.features || [];
  if (AVAILABLE_FEATURES.length <= 2) return false;

  if (feats.length === 1 && feats[0] === "text-input") {
    return Math.random() < 0.85; // reject most single-feature tools
  }
  return false;
}

async function generateUniqueToolConfig(existingTools, maxTries = 7) {
  const existingSlugs = new Set(existingTools.map((t) => t.slug?.toLowerCase()));
  const existingTitles = new Set(existingTools.map((t) => t.title?.toLowerCase()));

  for (let i = 0; i < maxTries; i++) {
    const config = await generateToolConfig(existingTools);

    const slugLower = (config.slug || "").toLowerCase();
    const titleLower = (config.title || "").toLowerCase();

    const slugDup = existingSlugs.has(slugLower);
    const titleDup = existingTitles.has(titleLower);
    const tooSimple = isTooSimple(config);

    if (slugDup || titleDup) continue;
    if (tooSimple) continue;

    return config;
  }

  console.warn("Retries exceeded; using last generated config as fallback.");
  return await generateToolConfig(existingTools);
}

function getUniqueSlugAndPath(baseSlug, configDir) {
  let slug = baseSlug;
  let counter = 1;
  let configPath = path.join(configDir, `${slug}.json`);

  while (fs.existsSync(configPath)) {
    slug = `${baseSlug}-${counter}`;
    configPath = path.join(configDir, `${slug}.json`);
    counter++;
  }

  return { slug, configPath };
}

function saveToolConfig(config) {
  const rootDir = path.join(__dirname, "..");
  const configDir = path.join(rootDir, "tool-configs");
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

  const { slug: uniqueSlug, configPath } = getUniqueSlugAndPath(config.slug, configDir);

  const finalConfig = { ...config, slug: uniqueSlug };

  fs.writeFileSync(configPath, JSON.stringify(finalConfig, null, 2), "utf-8");
  console.log(`Saved config to ${configPath}`);

  return finalConfig.slug;
}

async function main() {
  const existingTools = loadExistingTools();

  console.log("Generating new tool...");
  const config = await generateUniqueToolConfig(existingTools);
  console.log("Generated tool:", config.slug, "with features:", config.features);

  const finalSlug = saveToolConfig(config);
  console.log(`Saved config for slug "${finalSlug}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
