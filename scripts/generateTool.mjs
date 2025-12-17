// scripts/generate-tools.mjs
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

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * -------------------------------------------------------
 * ATLAS GENERATION ENGINE (v2) — “Top-down decomposition”
 * -------------------------------------------------------
 *
 * This upgrades the generator from "one-shot micro tool" to:
 * - Stage A: pick a niche + problem worth solving
 * - Stage B: generate a top-level SOFTWARE BLUEPRINT (architecture tree)
 * - Stage C: expand each component into concrete specs (pages, data, APIs, jobs)
 * - Stage D: emit a tool-config (backwards compatible) + a build-plan file
 *
 * IMPORTANT:
 * - Existing app expects tool-configs/*.json with the classic fields.
 * - We keep those stable and add OPTIONAL fields that your current UI can ignore.
 * - The new ToolClient update will start using these optional fields to enable
 *   "deep build" flows later (planner -> builder -> iterators).
 */

// Current UI-supported features (ToolClient reads these)
const AVAILABLE_FEATURES = [
  "text-input",
  "file-upload",
  "presets",
  "structured-output",
  "clarify-first",
  "saved-history",
];

// Generic refinement lenses (safe defaults)
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

// Reject scenario-specific preset labels
function isTooSpecificPresetLabel(label) {
  const s = String(label || "").toLowerCase();
  return (
    /manuscript|paper|psychology|biology|social science|case study|example|notes on a|poster on|clinical|patient|contract|lawsuit|tax return|resume for/i.test(
      s
    ) || s.length > 60
  );
}

function safeStr(x) {
  return typeof x === "string" ? x : "";
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function sanitizeTemperature(t) {
  const n = Number(t);
  if (!Number.isFinite(n)) return 0.6;
  return clamp(n, 0, 1);
}

function stripCodeFences(raw) {
  return (raw || "")
    .trim()
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

function toKebabSlug(s) {
  const base = String(s || "")
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 60);

  return base || "new-tool";
}

function requireField(config, key, fallback) {
  const v = safeStr(config?.[key]).trim();
  if (v) return v;
  return fallback;
}

async function repairJson(badJson, schemaHint = "unknown") {
  const system = `
You are a JSON repair function.

Rules:
- Output ONLY valid JSON.
- Do not include markdown fences.
- Do not add commentary.
- Keep keys that exist; do not invent new keys not implied by the broken input.
- If information is missing, use empty strings/arrays or null rather than inventing facts.
- The JSON should match the intended schema described in SCHEMA_HINT.
`.trim();

  const user = `
SCHEMA_HINT:
${schemaHint}

BROKEN_JSON:
${badJson}
`.trim();

  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0,
  });

  return stripCodeFences(completion.choices[0]?.message?.content ?? "");
}

async function chatJson({ system, user, schemaHint, temperature = 0.6 }) {
  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature,
  });

  let raw = stripCodeFences(completion.choices[0]?.message?.content ?? "");

  try {
    return JSON.parse(raw);
  } catch {
    const repaired = await repairJson(raw, schemaHint);
    return JSON.parse(repaired);
  }
}

/**
 * --------------------------------------
 * Stage A: Pick a problem worth building
 * --------------------------------------
 *
 * Output: a candidate "idea spec" with:
 * - niche (role + scenario)
 * - pain (repeated)
 * - what “software” would actually do
 * - whether it should become a “system” later
 */
const IDEA_RUBRIC = `
You are Atlas's "market + product taste" module.

Goal: propose ONE niche problem where a software system (not a prompt wrapper) creates serious leverage.

Hard constraints:
- Must be safe: no medical diagnosis, no legal advice, no wrongdoing.
- Must be in a real workflow with repeated use.
- Must be specific: role + scenario + inputs + outputs.
- Must be clearly different from existing tools provided.
- Must be feasible to start as a lightweight tool, but should have a clear upgrade path to a multi-page app/system.

Return ONLY JSON with this exact shape:

{
  "workingTitle": string,
  "niche": { "role": string, "scenario": string },
  "problem": string,
  "inputs": string[],
  "outputs": string[],
  "whyItWins": string[],
  "upgradePath": {
    "today": string,
    "in90Days": string,
    "in12Months": string
  },
  "riskNotes": string[]
}
`.trim();

/**
 * ------------------------------------------
 * Stage B: 1,000ft -> 100ft Software Blueprint
 * ------------------------------------------
 *
 * Output: a top-level blueprint tree.
 * This is the “decomposition backbone” Atlas will refine.
 */
const BLUEPRINT_RUBRIC = `
You are Atlas's "software architect" module.

Given an idea spec, produce a top-level blueprint that can evolve from a simple tool into a complex app/system.

Hard constraints:
- Keep the tree small and meaningful (3–8 main components).
- Prefer clear boundaries: UI pages, API routes, data models, background jobs.
- Identify what must be persisted (db) vs what is ephemeral.
- Include edge cases and failure modes.

Return ONLY JSON with this exact shape:

{
  "level": "micro-tool" | "multi-page-app",
  "summary": string,
  "primaryUser": string,
  "successMetrics": string[],
  "components": [
    {
      "id": string,
      "name": string,
      "type": "ui" | "api" | "data" | "job" | "integration",
      "responsibility": string,
      "dependsOn": string[],
      "notes": string[]
    }
  ],
  "dataModels": [
    {
      "name": string,
      "purpose": string,
      "fields": [
        { "name": string, "type": "string" | "number" | "boolean" | "date" | "json", "optional": boolean }
      ],
      "indexes": string[]
    }
  ],
  "pages": [
    {
      "route": string,
      "title": string,
      "purpose": string,
      "inputs": string[],
      "outputs": string[],
      "requiresAuth": boolean
    }
  ],
  "apiRoutes": [
    {
      "route": string,
      "method": "GET" | "POST",
      "purpose": string,
      "requestShape": string,
      "responseShape": string,
      "auth": "public" | "user"
    }
  ],
  "backgroundJobs": [
    { "name": string, "trigger": string, "purpose": string }
  ],
  "edgeCases": string[],
  "nonGoals": string[]
}
`.trim();

/**
 * -------------------------------------------------
 * Stage C: Expand each component into detailed specs
 * -------------------------------------------------
 *
 * Output: expanded specs + acceptance tests.
 */
const EXPAND_RUBRIC = `
You are Atlas's "system spec expander".

Given a blueprint, expand it into a buildable plan:
- clarify data flow
- define page-to-api contracts
- define validation rules
- define error handling patterns
- define acceptance tests

Hard constraints:
- Do NOT write full code here.
- Be precise and structured.
- Keep it implementable in a Next.js + API routes + Prisma-style stack.

Return ONLY JSON with this exact shape:

{
  "dataFlow": string[],
  "validationRules": string[],
  "errorHandling": string[],
  "securityNotes": string[],
  "acceptanceTests": [
    { "id": string, "given": string, "when": string, "then": string }
  ],
  "buildOrder": string[],
  "scaffolds": {
    "nextRoutesToCreate": string[],
    "apiFilesToCreate": string[],
    "prismaModelsToAdd": string[]
  }
}
`.trim();

/**
 * -------------------------------------------------------
 * Stage D: Emit a backwards-compatible TOOL CONFIG + extras
 * -------------------------------------------------------
 *
 * The tool config remains one-page usable.
 * But it now carries an optional "atlasBuildPlan" block that
 * the UI (future ToolClient) can use to run the multi-step flow.
 */
const TOOL_CONFIG_RUBRIC = `
You are Atlas's "tool config compiler".

You are given:
- an idea spec
- a blueprint
- expanded specs

Your job:
1) Produce a backwards-compatible tool config (single-page tool) that:
   - captures the core workflow now
   - is high-quality and safe
   - uses available features meaningfully
2) Embed OPTIONAL "atlasBuildPlan" metadata that:
   - records the blueprint + expansion
   - defines the next prompts the client can run later

Hard constraints:
- Tool must be usable as a single-page web app (input text + optional file upload).
- Output is plain text, and optionally valid JSON if structured-output enabled.
- Must be safe and refuse disallowed requests.
- Presets must be refinement lenses (generic labels).
- Features must be chosen ONLY from the provided features list.
- Keep the systemPrompt extremely specific and enforce rules.

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

  "presets"?: [{"label": string, "prompt": string, "hint"?: string}],
  "outputFormatDefault"?: "plain" | "json",
  "jsonSchemaHint"?: string,
  "clarifyPrompt"?: string,
  "finalizePrompt"?: string,

  // NEW OPTIONAL METADATA (ignored by current UI, used by future UI):
  "atlasBuildPlan"?: {
    "level": "micro-tool" | "multi-page-app",
    "idea": any,
    "blueprint": any,
    "expanded": any,
    "nextPrompts": [
      {
        "id": string,
        "title": string,
        "purpose": string,
        "promptTemplate": string
      }
    ]
  }
}
`.trim();

// ---- helpers to read existing tools ----
function loadExistingTools() {
  const rootDir = path.join(__dirname, "..");
  const configDir = path.join(rootDir, "tool-configs");
  if (!fs.existsSync(configDir)) return [];

  const files = fs.readdirSync(configDir).filter((f) => f.endsWith(".json"));

  return files
    .map((file) => {
      const fp = path.join(configDir, file);
      const content = fs.readFileSync(fp, "utf-8");
      try {
        const json = JSON.parse(content);
        return {
          slug: json.slug,
          title: json.title,
          description: json.description,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function summarizeExisting(existingTools) {
  if (!existingTools?.length) return "There are currently no existing tools.";
  return (
    "Existing tools:\n" +
    existingTools
      .map((t) => `- slug: ${t.slug}, title: ${t.title}, description: ${t.description}`)
      .join("\n")
  );
}

/**
 * Decide if a config is too simple.
 * With 6 features available, discourage only text-input.
 */
function isTooSimple(config) {
  const feats = config.features || [];
  if (AVAILABLE_FEATURES.length <= 2) return false;
  if (feats.length === 1 && feats[0] === "text-input") return Math.random() < 0.85;
  return false;
}

function normalizePresetsIfNeeded(features, presets) {
  if (!features.includes("presets")) return undefined;

  let out = Array.isArray(presets) ? presets : [];
  out = out
    .slice(0, 6)
    .map((p) => {
      const label = typeof p?.label === "string" ? p.label.trim().slice(0, 60) : "Refine";

      if (typeof p?.prompt === "string" && p.prompt.trim()) {
        return {
          label,
          prompt: p.prompt.trim().slice(0, 1200),
          hint: typeof p?.hint === "string" ? p.hint.trim().slice(0, 160) : undefined,
        };
      }

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

  if (out.length && out.some((p) => isTooSpecificPresetLabel(p.label))) {
    out = DEFAULT_LENSES.slice(0, 4);
  }

  if (out.length < 2) out = DEFAULT_LENSES.slice(0, 4);
  return out;
}

function normalizeToolConfig(config) {
  // --- features ---
  let features = config.features;
  if (!Array.isArray(features)) features = ["text-input"];
  features = features.map((f) => String(f)).filter((f) => AVAILABLE_FEATURES.includes(f));
  if (features.length === 0) features = ["text-input"];

  // ---- slug + required fields ----
  const normalizedSlug = toKebabSlug(config.slug || config.title);
  const title = requireField(config, "title", "Untitled Tool");
  const description = requireField(
    config,
    "description",
    "A one-page AI tool designed for a specific workflow."
  );
  const inputLabel = requireField(config, "inputLabel", "Paste your input text");
  const outputLabel = requireField(config, "outputLabel", "Generated output");
  const systemPrompt = requireField(
    config,
    "systemPrompt",
    "You are Atlas. Produce a useful, safe, and structured output. Do not invent facts."
  );
  const temperature = sanitizeTemperature(config.temperature);

  // ---- optional fields based on features ----
  const presets = normalizePresetsIfNeeded(features, config.presets);

  let outputFormatDefault = config.outputFormatDefault;
  let jsonSchemaHint = config.jsonSchemaHint;

  if (features.includes("structured-output")) {
    if (outputFormatDefault !== "json" && outputFormatDefault !== "plain") outputFormatDefault = "plain";
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

  // New optional metadata (kept if present)
  const atlasBuildPlan = config.atlasBuildPlan && typeof config.atlasBuildPlan === "object"
    ? config.atlasBuildPlan
    : undefined;

  return {
    slug: normalizedSlug,
    title,
    description,
    inputLabel,
    outputLabel,
    systemPrompt,
    temperature,
    features,
    ...(presets ? { presets } : {}),
    ...(outputFormatDefault ? { outputFormatDefault } : {}),
    ...(typeof jsonSchemaHint === "string" && jsonSchemaHint ? { jsonSchemaHint } : {}),
    ...(clarifyPrompt ? { clarifyPrompt } : {}),
    ...(finalizePrompt ? { finalizePrompt } : {}),
    ...(atlasBuildPlan ? { atlasBuildPlan } : {}),
  };
}

/**
 * ----------------------------
 * TOP-DOWN GENERATION PIPELINE
 * ----------------------------
 */
async function generateTopDown(existingTools) {
  const existingSummary = summarizeExisting(existingTools);

  // Stage A: Idea
  const idea = await chatJson({
    system: IDEA_RUBRIC,
    user: `${existingSummary}

Generate ONE idea that is clearly different from the above.
Avoid overlapping the same user role + scenario + output purpose.

Also: Prefer ideas that can evolve into a multi-page app/system in the future.`,
    schemaHint: "IDEA_SPEC schema",
    temperature: 0.75,
  });

  // Stage B: Blueprint
  const blueprint = await chatJson({
    system: BLUEPRINT_RUBRIC,
    user: `IDEA_SPEC:
${JSON.stringify(idea, null, 2)}

Produce the blueprint.`,
    schemaHint: "BLUEPRINT schema",
    temperature: 0.35,
  });

  // Stage C: Expand
  const expanded = await chatJson({
    system: EXPAND_RUBRIC,
    user: `BLUEPRINT:
${JSON.stringify(blueprint, null, 2)}

Expand it into a build plan.`,
    schemaHint: "EXPANDED schema",
    temperature: 0.25,
  });

  // Stage D: Compile to tool-config (back-compat) + next prompts
  const compiled = await chatJson({
    system: TOOL_CONFIG_RUBRIC,
    user: `AVAILABLE_FEATURES:
${JSON.stringify(AVAILABLE_FEATURES, null, 2)}

IDEA_SPEC:
${JSON.stringify(idea, null, 2)}

BLUEPRINT:
${JSON.stringify(blueprint, null, 2)}

EXPANDED:
${JSON.stringify(expanded, null, 2)}

Now compile a tool config.
Important:
- Must be single-page usable TODAY.
- But include atlasBuildPlan with the above objects.
- nextPrompts should include at least 4 prompts:
  1) "Planner: refine requirements" (ask missing constraints)
  2) "Architect: finalize pages + data models"
  3) "Builder: generate page stubs"
  4) "Integrator: wire pages -> API -> DB"
Each promptTemplate should include placeholders like {{USER_INPUT}}, {{BLUEPRINT}}, etc.`,
    schemaHint: "TOOL CONFIG schema",
    temperature: 0.65,
  });

  // Ensure atlasBuildPlan is present and coherent
  const atlasBuildPlan = {
    level: blueprint?.level === "multi-page-app" ? "multi-page-app" : "micro-tool",
    idea,
    blueprint,
    expanded,
    nextPrompts: Array.isArray(compiled?.atlasBuildPlan?.nextPrompts)
      ? compiled.atlasBuildPlan.nextPrompts.slice(0, 10)
      : [
          {
            id: "planner_refine",
            title: "Planner: refine requirements",
            purpose: "Tighten constraints and clarify missing requirements.",
            promptTemplate:
              "You are Atlas Planner. Given {{USER_INPUT}} and {{IDEA}}, ask up to 5 clarifying questions. Then output a refined requirements JSON with constraints, data sources, and success criteria.",
          },
          {
            id: "architect_finalize",
            title: "Architect: finalize pages + data models",
            purpose: "Finalize architecture boundaries (pages, APIs, data).",
            promptTemplate:
              "You are Atlas Architect. Using {{REQUIREMENTS}} and {{BLUEPRINT}}, output a finalized pages list, api contracts, and prisma-style data models.",
          },
          {
            id: "builder_stubs",
            title: "Builder: generate page stubs",
            purpose: "Create Next.js route stubs and UI flows.",
            promptTemplate:
              "You are Atlas Builder. Using {{FINAL_ARCH}}, generate minimal Next.js route component stubs (TSX) for each page route, with TODOs for wiring and validation.",
          },
          {
            id: "integrator_wire",
            title: "Integrator: wire pages -> API -> DB",
            purpose: "Connect UI to API and DB with safe validation and error handling.",
            promptTemplate:
              "You are Atlas Integrator. Using {{FINAL_ARCH}} and {{STUBS}}, produce wiring steps and code snippets for API routes and Prisma calls with error handling. Do not invent environment secrets.",
          },
        ],
  };

  compiled.atlasBuildPlan = atlasBuildPlan;

  return {
    idea,
    blueprint,
    expanded,
    toolConfig: normalizeToolConfig(compiled),
  };
}

async function generateUniqueToolConfig(existingTools, maxTries = 7) {
  const existingSlugs = new Set(existingTools.map((t) => String(t.slug || "").toLowerCase()));
  const existingTitles = new Set(existingTools.map((t) => String(t.title || "").toLowerCase()));

  let last = null;

  for (let i = 0; i < maxTries; i++) {
    const { toolConfig } = await generateTopDown(existingTools);
    last = toolConfig;

    const slugLower = (toolConfig.slug || "").toLowerCase();
    const titleLower = (toolConfig.title || "").toLowerCase();

    const slugDup = existingSlugs.has(slugLower);
    const titleDup = existingTitles.has(titleLower);
    const tooSimple = isTooSimple(toolConfig);

    if (slugDup || titleDup) continue;
    if (tooSimple) continue;

    return toolConfig;
  }

  console.warn("Retries exceeded; using last generated config as fallback.");
  return last || (await generateTopDown(existingTools)).toolConfig;
}

function getUniqueSlugAndPath(baseSlug, configDir) {
  const base = toKebabSlug(baseSlug);
  let slug = base;
  let counter = 1;
  let configPath = path.join(configDir, `${slug}.json`);

  while (fs.existsSync(configPath)) {
    slug = `${base}-${counter}`;
    configPath = path.join(configDir, `${slug}.json`);
    counter++;
  }

  return { slug, configPath };
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function saveBuildPlanFiles(slug, atlasBuildPlan) {
  const rootDir = path.join(__dirname, "..");
  const planDir = path.join(rootDir, "tool-plans");
  ensureDir(planDir);

  const jsonPath = path.join(planDir, `${slug}.plan.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(atlasBuildPlan, null, 2), "utf-8");

  // Also write a human-readable markdown snapshot
  const mdPath = path.join(planDir, `${slug}.plan.md`);
  const md = [
    `# ${slug} — Atlas Build Plan`,
    ``,
    `## Level`,
    `${atlasBuildPlan?.level || "micro-tool"}`,
    ``,
    `## Idea`,
    "```json",
    JSON.stringify(atlasBuildPlan?.idea ?? {}, null, 2),
    "```",
    ``,
    `## Blueprint`,
    "```json",
    JSON.stringify(atlasBuildPlan?.blueprint ?? {}, null, 2),
    "```",
    ``,
    `## Expanded Specs`,
    "```json",
    JSON.stringify(atlasBuildPlan?.expanded ?? {}, null, 2),
    "```",
    ``,
    `## Next Prompts`,
    ...(Array.isArray(atlasBuildPlan?.nextPrompts)
      ? atlasBuildPlan.nextPrompts.map(
          (p) =>
            `### ${p.id} — ${p.title}\n\n**Purpose:** ${p.purpose}\n\n\`\`\`\n${p.promptTemplate}\n\`\`\`\n`
        )
      : []),
  ].join("\n");

  fs.writeFileSync(mdPath, md, "utf-8");

  console.log(`Saved build plan:\n- ${jsonPath}\n- ${mdPath}`);
}

function saveToolConfig(config) {
  const rootDir = path.join(__dirname, "..");
  const configDir = path.join(rootDir, "tool-configs");
  ensureDir(configDir);

  const { slug: uniqueSlug, configPath } = getUniqueSlugAndPath(config.slug, configDir);
  const finalConfig = { ...config, slug: uniqueSlug };

  fs.writeFileSync(configPath, JSON.stringify(finalConfig, null, 2), "utf-8");
  console.log(`Saved tool config to ${configPath}`);

  // Save build plan snapshots if present
  if (finalConfig?.atlasBuildPlan) {
    saveBuildPlanFiles(uniqueSlug, finalConfig.atlasBuildPlan);
  }

  return finalConfig.slug;
}

async function main() {
  const existingTools = loadExistingTools();

  console.log("Generating new tool (top-down)...");
  const config = await generateUniqueToolConfig(existingTools);

  console.log(
    "Generated tool:",
    config.slug,
    "with features:",
    config.features,
    config?.atlasBuildPlan?.level ? `| plan: ${config.atlasBuildPlan.level}` : ""
  );

  const finalSlug = saveToolConfig(config);
  console.log(`Saved config for slug "${finalSlug}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
