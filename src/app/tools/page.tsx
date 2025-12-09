import fs from "fs";
import path from "path";
import Link from "next/link";

type ToolSummary = {
  slug: string;
  title: string;
  description: string;
};

export default async function ToolsIndexPage() {
  const indexPath = path.join(process.cwd(), "tool-index.json");
  const raw = fs.readFileSync(indexPath, "utf-8");
  const tools: ToolSummary[] = JSON.parse(raw);

  return (
    <main className="min-h-screen px-4 py-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Available Tools</h1>
      <p className="mb-6 text-gray-700">
        Each tool is a single-page AI app powered by a JSON config file.
      </p>

      <div className="space-y-4">
        {tools.map((tool) => (
          <Link
            key={tool.slug}
            href={`/tools/${tool.slug}`}
            className="block border rounded-md p-4 hover:bg-gray-50"
          >
            <h2 className="text-xl font-semibold">{tool.title}</h2>
            <p className="text-gray-700">{tool.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
