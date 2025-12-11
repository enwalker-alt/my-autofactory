"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

type ToolMeta = {
  slug: string;
  title: string;
  description: string;
};

type Props = {
  tools: ToolMeta[];
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  writing: ["email", "script", "dialogue", "speaker", "copy", "write"],
  education: ["academic", "student", "research", "study", "lesson"],
  business: ["business", "plan", "strategy", "operations", "process"],
  events: ["event", "agenda", "checklist", "meeting", "conference"],
  creative: ["comic", "story", "creative", "narrative", "content"],
  // "all" handled by just not filtering
};

const CATEGORY_LABELS: Record<string, string> = {
  writing: "Writing & Communication",
  education: "Learning & Research",
  business: "Business & Operations",
  events: "Events & Planning",
  creative: "Creative & Media",
};

export default function ToolLibraryClient({ tools }: Props) {
  const searchParams = useSearchParams();

  const qRaw = searchParams.get("q") || "";
  const query = qRaw.trim().toLowerCase();

  const category = searchParams.get("category") || "";

  let filtered = tools;

  // Free-text search
  if (query) {
    filtered = filtered.filter((tool) => {
      const haystack = (tool.title + " " + tool.description).toLowerCase();
      return haystack.includes(query);
    });
  }

  // Category filter
  if (category && category !== "all") {
    const keywords = CATEGORY_KEYWORDS[category];
    if (keywords && keywords.length > 0) {
      filtered = filtered.filter((tool) => {
        const haystack = (tool.title + " " + tool.description).toLowerCase();
        return keywords.some((kw) => haystack.includes(kw));
      });
    }
  }

  const total = tools.length;
  const count = filtered.length;

  const categoryLabel = CATEGORY_LABELS[category];

  return (
    <div>
      {/* Status line */}
      <div className="mb-4 text-xs md:text-sm text-gray-400 flex flex-wrap items-center justify-center gap-2">
        <span>
          Showing <span className="text-purple-200 font-medium">{count}</span> of{" "}
          <span className="text-purple-200 font-medium">{total}</span> tools
        </span>
        {(query || categoryLabel) && (
          <>
            <span className="hidden sm:inline-block text-gray-600">•</span>
            <span className="flex flex-wrap items-center gap-1">
              {query && (
                <>
                  for
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs border border-white/10">
                    “{qRaw}”
                  </span>
                </>
              )}
              {categoryLabel && (
                <>
                  {query ? "in" : "for"}
                  <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs border border-purple-400/40 text-purple-100">
                    {categoryLabel}
                  </span>
                </>
              )}
            </span>
          </>
        )}
      </div>

      {/* Empty state */}
      {count === 0 && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-xs md:text-sm text-gray-400">
          No tools match your current filters.
          <div className="mt-2">
            Try clearing the search, picking a different category, or browsing
            all tools.
          </div>
        </div>
      )}

      {/* Grid */}
      {count > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mt-4">
          {filtered.map((tool) => (
            <Link
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              className="group rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-400/40 transition duration-200 p-4 flex flex-col justify-between"
            >
              <div>
                <h2 className="text-sm md:text-base font-medium mb-1 group-hover:text-white">
                  {tool.title}
                </h2>
                <p className="text-xs md:text-sm text-gray-400 line-clamp-3">
                  {tool.description}
                </p>
              </div>
              <div className="mt-3 text-[11px] text-purple-300/90 group-hover:text-purple-200">
                Open tool →
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
