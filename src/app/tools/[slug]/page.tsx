import fs from "fs";
import path from "path";
import ToolClient from "./ToolClient";

type ToolConfig = {
  slug: string;
  title: string;
  description: string;
  inputLabel: string;
  outputLabel: string;
  systemPrompt: string;
  temperature?: number;
};

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // 👇 Unwrap the params Promise (Next 16 / React 19 style)
  const { slug } = await params;

  const configPath = path.join(
    process.cwd(),
    "tool-configs",
    `${slug}.json`
  );

  // Optional: debug logs – you’ll see these in the terminal running `npm run dev`
  console.log("[ToolPage] slug:", slug);
  console.log(
    "[ToolPage] looking for:",
    configPath,
    "exists:",
    fs.existsSync(configPath)
  );

  if (!fs.existsSync(configPath)) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Tool not found.</p>
      </main>
    );
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  const config: ToolConfig = JSON.parse(raw);

  return (
    <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">{config.title}</h1>
      <p className="text-gray-700 mb-4">{config.description}</p>

      <ToolClient
        slug={config.slug}
        inputLabel={config.inputLabel}
        outputLabel={config.outputLabel}
      />
    </main>
  );
}
