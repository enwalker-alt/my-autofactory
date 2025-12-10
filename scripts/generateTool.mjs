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
 * "dropdown-presets", etc.) and expose them to the model via RUBRIC.
 *
 * For now, we support:
 * - "text-input"  → a big textarea for freeform text
 * - "file-upload" → a file uploader; you'll wire this to feed text in
 */
const AVAILABLE_FEATURES = ["text-input", "file-upload"];

const RUBRIC = `
You are an idea generator for small, one-page AI tools.

Constraints:
- Each tool must be usable as a single-page web app.
- Input is plain text (textarea) and/or text extracted from uploaded files.
- Output is plain text.
- Target a specific niche (e.g., nurses, real estate agents, teachers, salespeople, etc.).
- Must be actually useful, not a joke.
- Avoid anything medical diagnosis, legal advice, or unsafe content.
- The niche and use-case must be clearly different from existing tools (no overlapping user role or text type).

AVAILABLE FEATURES (capabilities you can choose from for each tool):

1) "text-input"
   - User can type or paste freeform text into a textarea.
   - Most tools should include this.

2) "file-upload"
   - User can upload one or more files (e.g., .txt, .md, .csv, or other text-based documents).
   - The app will read the text content of the file and feed it to the AI alongside any typed input.
   - Only include this if the tool genuinely benefits from analyzing the contents of a document
     (e.g., extracting KPIs from a report, summarizing a contract, pulling tasks from meeting notes, etc.).

IMPORTANT:
- For EVERY tool you generate, you MUST include a "features" array listing which features it uses.
- "features" may only contain feature names from the list above.
- If the tool only needs a textarea, use: ["text-input"]
- If the tool needs both a textarea and uploaded document(s), use: ["text-input", "file-upload"]

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
          "Choose the minimal set of features needed for this tool and set the 'features' array accordingly.",
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

// Try a few times to avoid duplicate slug/title
async function generateUniqueToolConfig(existingTools, maxTries = 5) {
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

    if (!slugDup && !titleDup) {
      return config;
    }

    console.log(
      `Generated config was too similar to an existing tool (try ${
        i + 1
      }/${maxTries}). Retrying...`
    );
  }

  throw new Error("Failed to generate a unique tool after several attempts.");
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
  console.log("Generated tool:", config.slug);

  const finalSlug = saveToolConfig(config);
  console.log(`Saved config for slug "${finalSlug}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
