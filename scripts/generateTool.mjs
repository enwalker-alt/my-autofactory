import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import OpenAI from "openai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const RUBRIC = `
You are an idea generator for small, one-page AI tools.

Constraints:
- Each tool must be usable as a single-page web app.
- Input is plain text (textarea).
- Output is plain text.
- Target a specific niche (e.g., nurses, real estate agents, teachers, salespeople, etc.).
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

function saveToolConfig(config) {
  const rootDir = path.join(__dirname, "..");
  const configDir = path.join(rootDir, "tool-configs");
  const indexPath = path.join(rootDir, "tool-index.json");
  const configPath = path.join(configDir, `${config.slug}.json`);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  if (fs.existsSync(configPath)) {
    throw new Error(`Config for slug ${config.slug} already exists.`);
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

  const indexRaw = fs.readFileSync(indexPath, "utf-8");
  const index = JSON.parse(indexRaw);

  index.push({
    slug: config.slug,
    title: config.title,
    description: config.description,
  });

  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf-8");
}

function gitCommitAndPush(slug) {
  // Requires a git repo + remote already set up
  execSync("git add tool-configs tool-index.json", { stdio: "inherit" });
  execSync(`git commit -m "Add tool ${slug}"`, { stdio: "inherit" });
  execSync("git push", { stdio: "inherit" });
}

async function main() {
  console.log("Generating new tool...");
  const config = await generateToolConfig();
  console.log("Generated tool:", config.slug);

  saveToolConfig(config);
  console.log("Saved config and updated index.");

  try {
    gitCommitAndPush(config.slug);
    console.log("Git push complete. Vercel should deploy automatically.");
  } catch (err) {
    console.error("Git commit/push failed (is git set up?):", err.message);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
