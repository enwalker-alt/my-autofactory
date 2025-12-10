"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMemo } from "react";

type ToolMeta = {
  slug: string;
  title: string;
  description: string;
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
  if (title === q) score += 120;
  if (title.startsWith(q)) score += 80;

  const wordRegex = new RegExp(`\\b${escapeRegExp(q)}`);
  if (wordRegex.test(title)) score += 50;

  if (title.includes(q)) score += 40;
  if (desc.includes(q)) score += 20;

  return score;
}

export default function ToolsClient({ tools }: { tools: ToolMeta[] }) {
  const params = useSearchParams();
  const rawQuery = (params.get("q") ?? "").trim();
  const query = rawQuery.toLowerCase();

  const filteredTools = useMemo(() => {
    if (!query) return tools;

    const scored = tools
      .map((tool) => ({ tool, score: scoreTool(tool, query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.map((s) => s.tool);
  }, [query, tools]);

  return (
    <>
      <p className="text-xs md:text-sm text-gray-500 text-center mb-4">
        Showing{" "}
        <span className="text-gray-200 font-medium">{filteredTools.length}</span>{" "}
        of{" "}
        <span className="text-gray-400 font-medium">{tools.length}</span> tools
        {rawQuery && (
          <>
            {" "}
            for <span className="text-gray-300">&quot;{rawQuery}&quot;</span>
          </>
        )}
      </p>

      {filteredTools.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-6 text-sm text-gray-400 text-center">
          No tools match{" "}
          <span className="font-medium text-gray-200">
            &ldquo;{rawQuery}&rdquo;
          </span>
          .
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
                    <span>Open tool</span> →
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
