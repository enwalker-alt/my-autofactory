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

const RUBRIC = `
You are an idea generator for small, one-page AI tools.

Constraints:
- Each tool must be usable as a single-page web app.
- Input is plain text (textarea).
- Output is plain text.
- Target a specific niche
- Must be actually useful, not a joke.
- Avoid anything medical diagnosis, legal advice, or unsafe content.

Return ONLY strict JSON with this shape:
{
  "slug": string (kebab-case, no spaces),
  "title": string,
  "description": string,
  "inputLabel": string,
  "outputLabel": string,
  "systemPrompt": string,
  "temperature": number between 0 and 1
}
`;

async function generateToolConfig() {
  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: RUBRIC },
      { role: "user", content: "Generate one new tool config JSON now." },
    ],
    temperature: 0.7,
  });

  let raw = completion.choices[0]?.message?.content ?? "";
  raw = raw.trim().replace(/```json/g, "").replace(/```/g, "");

  const config = JSON.parse(raw);
  return config;
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
  const indexPath = path.join(rootDir, "tool-index.json");

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Get a unique slug + path so we never fail just because a slug already exists
  const { slug: uniqueSlug, configPath } = getUniqueSlugAndPath(
    config.slug,
    configDir
  );

  const finalConfig = { ...config, slug: uniqueSlug };

  fs.writeFileSync(configPath, JSON.stringify(finalConfig, null, 2), "utf-8");
  console.log(`Saved config to ${configPath}`);

  // Read existing index if it exists, otherwise start a new array
  let index = [];
  if (fs.existsSync(indexPath)) {
    const indexRaw = fs.readFileSync(indexPath, "utf-8");
    index = JSON.parse(indexRaw);
  }

  index.push({
    slug: finalConfig.slug,
    title: finalConfig.title,
    description: finalConfig.description,
  });

  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf-8");
  console.log(`Updated tool-index.json with slug "${finalConfig.slug}"`);

  return finalConfig.slug;
}

async function main() {
  console.log("Generating new tool...");
  const config = await generateToolConfig();
  console.log("Generated tool:", config.slug);

  const finalSlug = saveToolConfig(config);
  console.log(`Saved config and updated index for slug "${finalSlug}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
