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
 * You can keep extending this list over time (e.g. "multi-step-form",
 * "dropdown-presets", "file-upload", "saved-history", etc.) and expose
 * them to the model via RUBRIC.
 *
 * For now, we support:
 * - "text-input"  → a big textarea for freeform text
 * - "file-upload" → a file uploader; you'll wire this to feed text in
 */
const AVAILABLE_FEATURES = ["text-input", "file-upload"];

const RUBRIC = `
You are an expert product designer and idea generator for small, one-page AI tools.

Your goal: generate tools that are:
- truly useful in a specific real-world workflow
- genuinely original (not prompt-wrapper clones)
- niche-dominant (ideally the only tool someone would search for in that exact situation)

HARD CONSTRAINTS (must follow):
- Each tool must be usable as a single-page web app.
- Input is plain text (textarea) and/or text extracted from uploaded files.
- Output is plain text.
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
   - The app will read the text content of the file and feed it to the AI
     alongside any typed input.
   - Only include this if the tool genuinely benefits from analyzing
     the contents of a document (e.g., extracting KPIs from a report,
     summarizing a contract, pulling tasks from meeting notes, etc.).

SCALING & COMPLEXITY GUIDELINES:
- As the platform gains more features, you should generally use MULTIPLE features together so tools feel richer and more capable.
- Simple single-feature tools that only use ["text-input"] are allowed, but should be relatively rare (no more than about 10–20% of tools).
- Prefer designs that combine 2–4 features in a meaningful way whenever those features would clearly improve the user experience.
- With ONLY the two current features, prefer ["text-input","file-upload"] when the core value depends on a document; otherwise keep it ["text-input"].

IMPORTANT FEATURE RULES (must follow):
- For EVERY tool you generate, you MUST include a "features" array listing which features it uses.
- "features" may only contain feature names from the list above.
- If the tool only needs a textarea, use: ["text-input"]
  (this should be uncommon after the platform has many features).
- If the tool needs a textarea AND uploaded document(s), use:
  ["text-input", "file-upload"].

ORIGINALITY / “ONLY SOLUTION” REQUIREMENTS (critical):
To be accepted, the idea must pass ALL of these tests:

A) Moment-of-use specificity
- The tool must be designed for a specific moment in a workflow (not “anytime”).
- It should feel like: “I need this right now to avoid a mistake / save time / hit a standard.”

B) Not a prompt wrapper
Reject ideas that are essentially:
- generic rewriting
- generic summarizing
- generic email drafting
unless they have a tight niche constraint + required structure + clear failure mode that generic chatbots often miss.

C) “Why existing tools fail” built into the system prompt
- The systemPrompt must enforce structure and constraints so the output is consistently useful.
- The tool must do a transformation that general AI struggles to do reliably without guardrails.

D) Unique “moat hook”
The tool must have at least one of the following:
- strict formatting requirements (checklist/template with required sections)
- role-specific constraints and “do/don’t” rules
- input-to-output transformation that is hard to do ad hoc (e.g., mapping messy text into a standardized artifact)
- compliance/safety-safe constraints WITHOUT giving legal/medical advice (e.g., “non-legal, non-diagnostic language”)

E) Clear non-overlap
- Do NOT overlap existing tools’ user role + text type + output purpose.
- If unsure, choose a rarer niche and a different artifact.

SYSTEM PROMPT QUALITY BAR (must follow):
Your "systemPrompt" must:
- Clearly state the niche user and the exact artifact being produced.
- Enforce a structured output with headings/bullets and required sections.
- Include 3–6 hard rules (e.g., “Do not invent facts,” “If missing info, ask 3 clarifying questions,” “Use concise bullets,” etc.).
- Produce output that feels immediately usable (copy/paste into the user’s workflow).
- Avoid policy-problematic content and explicitly refuse disallowed requests.

SLUG RULES:
- slug must be kebab-case, lowercase, no spaces, no punctuation except hyphens.
- It must be unique versus existing tools (you will be given the existing list).

TEMPERATURE RULE:
- Provide a temperature between 0 and 1.
- Default guideline:
  - 0.3–0.5 for structured/precision tools
  - 0.6–0.8 for creative-but-controlled tools
Pick based on the job.

Return ONLY strict JSON with this exact shape (no extra top-level keys, no commentary):

{
  "slug": string (kebab-case, no spaces),
  "title": string,
  "description": string,
  "inputLabel": string,
  "outputLabel": string,
  "systemPrompt": string,
  "temperature": number between 0 and 1,
  "features": string[] // e.g. ["text-input"] or ["text-input", "file-upload"]
}
`;

// ---- helpers to read existing tools ----

function loadExistingTools() {
  const rootDir = path.join(__dirname, "..");
  const configDir = path.join(rootDir, "tool-configs");

  if (!fs.existsSync(configDir)) {
    return [];
  }

  const files = fs
    .readdirSync(configDir)
    .filter((file) => file.endsWith(".json"));

  const tools = files.map((file) => {
    const filePath = path.join(configDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
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
  });

  return tools.filter(Boolean);
}

// ---- OpenAI call ----

async function generateToolConfig(existingTools) {
  const existingSummary =
    existingTools.length === 0
      ? "There are currently no existing tools."
      : "Existing tools:\n" +
        existingTools
          .map(
            (t) =>
              `- slug: ${t.slug}, title: ${t.title}, description: ${t.description}`
          )
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
          "Do not create anything about nursing, real estate, or academic abstracts/papers/summaries if those are in the list. " +
          "Avoid overlapping the same user role or type of input text.\n\n" +
          "Choose the minimal set of features needed for this tool, but generally prefer combining multiple features in a meaningful and non-gimmicky way.",
      },
    ],
    temperature: 0.7,
  });

  let raw = completion.choices[0]?.message?.content ?? "";
  raw = raw.trim().replace(/```json/g, "").replace(/```/g, "");

  const config = JSON.parse(raw);

  // --- Safety: normalize / validate features ---
  let features = config.features;
  if (!Array.isArray(features)) {
    // Default to text-input if model forgets
    features = ["text-input"];
  } else {
    // Filter out unknown features
    features = features.filter((f) => AVAILABLE_FEATURES.includes(f));
    if (features.length === 0) {
      features = ["text-input"];
    }
  }

  return {
    ...config,
    features,
  };
}

/**
 * Decide if a config is "too simple" given the global feature set.
 * - While AVAILABLE_FEATURES is small (<= 2), we allow simple tools.
 * - Once AVAILABLE_FEATURES grows larger, we strongly discourage tools
 *   that only use ["text-input"], but still allow them occasionally.
 */
function isTooSimple(config) {
  const feats = config.features || [];

  // If we don't have many global features yet, never treat anything as "too simple"
  if (AVAILABLE_FEATURES.length <= 2) {
    return false;
  }

  // If the tool only uses text-input, this is "too simple" most of the time
  if (feats.length === 1 && feats[0] === "text-input") {
    // Allow ~20% single-feature tools, reject the other ~80%
    return Math.random() < 0.8;
  }

  return false;
}

// Try a few times to avoid duplicate slug/title AND overly simple tools
async function generateUniqueToolConfig(existingTools, maxTries = 7) {
  const existingSlugs = new Set(
    existingTools.map((t) => t.slug?.toLowerCase())
  );
  const existingTitles = new Set(
    existingTools.map((t) => t.title?.toLowerCase())
  );

  for (let i = 0; i < maxTries; i++) {
    const config = await generateToolConfig(existingTools);

    const slugLower = (config.slug || "").toLowerCase();
    const titleLower = (config.title || "").toLowerCase();

    const slugDup = existingSlugs.has(slugLower);
    const titleDup = existingTitles.has(titleLower);
    const tooSimple = isTooSimple(config);

    if (slugDup || titleDup) {
      console.log(
        `Generated config was too similar to an existing tool (try ${
          i + 1
        }/${maxTries}). Retrying...`
      );
      continue;
    }

    if (tooSimple) {
      console.log(
        `Generated config uses only [\"text-input\"] and is considered too simple (try ${
          i + 1
        }/${maxTries}). Retrying for a richer feature combo...`
      );
      continue;
    }

    return config;
  }

  // If all retries fail, just return the last config we got (even if simple),
  // so the script doesn't completely fail.
  console.warn(
    "Failed to generate a unique, sufficiently complex tool after several attempts; using last generated config."
  );
  const fallbackConfig = await generateToolConfig(existingTools);
  return fallbackConfig;
}

/**
 * Ensure we get a unique slug + file path.
 * If "my-tool" exists, we try "my-tool-1", "my-tool-2", ...
 */
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

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const { slug: uniqueSlug, configPath } = getUniqueSlugAndPath(
    config.slug,
    configDir
  );

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
