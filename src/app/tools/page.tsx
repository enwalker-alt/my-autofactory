import fs from "fs";
import path from "path";
import Link from "next/link";
import SearchBar from "./SearchBar";
import ToolLibraryClient from "./ToolLibraryClient";

export const dynamic = "force-dynamic";

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

  return files
    .map((file) => {
      const filePath = path.join(configDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const json = JSON.parse(content);

      return {
        slug: json.slug,
        title: json.title,
        description: json.description,
      } as ToolMeta;
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

export default function ToolsPage() {
  const tools = getToolsFromConfigs();

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#050816] via-[#020617] to-black text-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-12 md:py-16">

        {/* HEADER */}
        <section className="mb-10 md:mb-12">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-[0.25em] text-purple-300/80 mb-3 uppercase">
              AI Micro-Apps
            </p>

            {/* Title + Back Button on same row */}
            <div className="flex items-center justify-center gap-3 mb-3">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold">
                Tool Library
              </h1>

              <Link
                href="/"
                className="
                  px-3 py-1.5
                  text-xs font-medium
                  rounded-lg
                  bg-white/5
                  border border-white/10
                  backdrop-blur
                  hover:bg-white/10
                  transition
                  duration-200
                  whitespace-nowrap
                "
              >
                ← Home
              </Link>
            </div>

            <p className="text-sm md:text-base text-gray-400 max-w-2xl mx-auto">
              Browse all experimental tools in Atlas. Each card opens a focused,
              single-page AI experience.
            </p>
          </div>

          {/* LIVE SEARCH BAR */}
          <div className="mt-8 space-y-3">
            <SearchBar />
          </div>
        </section>

        {/* CLIENT FILTERING + TOOL GRID */}
        <section className="mt-6">
          <ToolLibraryClient tools={tools} />
        </section>

      </div>
    </main>
  );
}
