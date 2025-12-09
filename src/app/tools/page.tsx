import fs from "fs";
import path from "path";
import Link from "next/link";

type ToolMeta = {
  slug: string;
  title: string;
  description: string;
};

function getToolsFromConfigs(): ToolMeta[] {
  const configDir = path.join(process.cwd(), "tool-configs");
  const files = fs
    .readdirSync(configDir)
    .filter((file) => file.endsWith(".json"));

  return files.map((file) => {
    const filePath = path.join(configDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const json = JSON.parse(content);

    return {
      slug: json.slug,
      title: json.title,
      description: json.description,
    } as ToolMeta;
  });
}

export default function ToolsPage() {
  const tools = getToolsFromConfigs();

  return (
    <main className="max-w-3xl mx-auto py-12">
      <h1 className="text-3xl font-bold mb-4">Available Tools</h1>
      <p className="text-gray-600 mb-8">
        Each tool is a single-page AI app powered by a JSON config file.
      </p>

      <div className="space-y-4">
        {tools.map((tool) => (
          <Link key={tool.slug} href={`/tools/${tool.slug}`}>
            <div className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
              <h2 className="font-semibold">{tool.title}</h2>
              <p className="text-sm text-gray-600">{tool.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
