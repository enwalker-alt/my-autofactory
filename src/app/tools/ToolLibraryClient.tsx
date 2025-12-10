// src/app/tools/ToolsClient.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ToolMeta = {
  slug: string;
  title: string;
  description: string;
};

type ToolsClientProps = {
  tools: ToolMeta[];
};

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scoreTool(tool: ToolMeta, query: string): number {
  if (!query) return 0;

  const q = query.toLowerCase();
  const title = tool.title.toLowerCase();
  const desc = tool.description.toLowerCase();

  let score = 0;

  // Exact / strong matches
  if (title === q) score += 120;
  if (title.startsWith(q)) score += 80;

  // Word-boundary match in title
  const wordRegex = new RegExp(`\\b${escapeRegExp(q)}`);
  if (wordRegex.test(title)) score += 50;

  // Anywhere in title / description
  if (title.includes(q)) score += 40;
  if (desc.includes(q)) score += 20;

  return score;
}

export default function ToolsClient({ tools }: ToolsClientProps) {
  const [query, setQuery] = useState("");

  const filteredTools = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;

    const scored = tools
      .map((tool) => ({ tool, score: scoreTool(tool, q) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.tool.title.localeCompare(b.tool.title);
      });

    // If nothing scored, fall back to showing all
    if (scored.length === 0) return tools;

    return scored.map(({ tool }) => tool);
  }, [query, tools]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#050816] via-[#020617] to-black text-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-12 md:py-16">
        {/* Header */}
        <section className="mb-10 md:mb-12">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-[0.25em] text-purple-300/80 mb-3 uppercase">
              AI Micro-Apps
            </p>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-3">
              Tool Library
            </h1>
            <p className="text-sm md:text-base text-gray-400 max-w-2xl mx-auto">
              Browse all experimental tools in Atlas. Each card opens a focused,
              single-page AI experience.
            </p>
          </div>

          {/* Search + meta */}
          <div className="mt-8 space-y-3">
            {/* No actual form submit needed; we search as you type */}
            <div className="w-full max-w-md mx-auto">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-4.35-4.35M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z"
                    />
                  </svg>
                </span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tools by name or description..."
                  className="w-full rounded-2xl bg-white/5 border border-white/10 px-10 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40"
                />
              </div>
            </div>

            <p className="text-xs md:text-sm text-gray-500 text-center">
              Showing{" "}
              <span className="text-gray-200 font-medium">
                {filteredTools.length}
              </span>{" "}
              of{" "}
              <span className="text-gray-400 font-medium">{tools.length}</span>{" "}
              tools
              {query.trim() && (
                <>
                  {" "}
                  for <span className="text-gray-300">&quot;{query}&quot;</span>
                </>
              )}
            </p>
          </div>
        </section>

        {/* Tools grid */}
        <section>
          {filteredTools.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-6 text-sm text-gray-400 text-center">
              No tools match{" "}
              <span className="font-medium text-gray-200">
                &ldquo;{query}&rdquo;
              </span>
              . Try a different keyword.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {filteredTools.map((tool) => (
                <Link key={tool.slug} href={`/tools/${tool.slug}`}>
                  <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 md:p-6 cursor-pointer transition-transform duration-200 hover:-translate-y-0.5 hover:border-purple-400/70 hover:bg-white/10">
                    <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-purple-500/15 via-transparent to-cyan-500/15" />
                    <div className="relative">
                      <h2 className="text-base md:text-lg font-semibold mb-1.5">
                        {tool.title}
                      </h2>
                      <p className="text-xs md:text-sm text-gray-300 leading-relaxed">
                        {tool.description}
                      </p>
                      <div className="mt-4 text-xs text-purple-300/80 flex items-center gap-1">
                        <span>Open tool</span>
                        <span aria-hidden="true" className="translate-y-[1px]">
                          →
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
