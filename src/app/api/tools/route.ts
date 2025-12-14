import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

type ToolMeta = {
  slug: string;
  title: string;
  description: string;
  avgRating?: number | null;
  ratingCount?: number | null;
};

export const dynamic = "force-dynamic";

function getToolsFromConfigs(): ToolMeta[] {
  const configDir = path.join(process.cwd(), "tool-configs");

  if (!fs.existsSync(configDir)) return [];

  const files = fs
    .readdirSync(configDir)
    .filter((f) => f.endsWith(".json"));

  const tools = files
    .map((file) => {
      try {
        const filePath = path.join(configDir, file);
        const content = fs.readFileSync(filePath, "utf-8");
        const json = JSON.parse(content);

        return {
          slug: String(json.slug ?? file.replace(/\.json$/, "")),
          title: String(json.title ?? "Untitled Tool"),
          description: String(json.description ?? ""),
          // ratings optional; your home marquee will gracefully show “New tool…”
          avgRating:
            typeof json.avgRating === "number" ? json.avgRating : null,
          ratingCount:
            typeof json.ratingCount === "number" ? json.ratingCount : null,
        } as ToolMeta;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as ToolMeta[];

  tools.sort((a, b) => a.title.localeCompare(b.title));
  return tools;
}

export async function GET() {
  const tools = getToolsFromConfigs();
  return NextResponse.json({ tools });
}
