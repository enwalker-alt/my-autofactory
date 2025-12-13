"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type ToolMeta = {
  slug: string;
  title: string;
  description: string;
};

type Props = {
  tools: ToolMeta[];
};

const PER_PAGE = 20;

// ✅ dropdown only these two
const SORT_OPTIONS = [
  { id: "title-az", label: "A → Z" },
  { id: "title-za", label: "Z → A" },
] as const;

type SortId = (typeof SORT_OPTIONS)[number]["id"];

const CATEGORY_RULES: Record<
  string,
  {
    label: string;
    strong: string[];
    weak: string[];
    phrases: string[];
    minScore: number;
  }
> = {
  writing: {
    label: "Writing & Messaging",
    phrases: [
      "cover letter",
      "linkedin post",
      "press release",
      "email response",
      "email reply",
      "follow up",
      "cold email",
      "sales email",
      "job application",
      "rewrite",
      "tone",
    ],
    strong: [
      "email",
      "copy",
      "rewrite",
      "edit",
      "grammar",
      "proof",
      "message",
      "reply",
      "response",
      "bio",
      "resume",
      "cover",
      "letter",
      "proposal",
      "pitch",
      "script",
      "dialogue",
      "headline",
    ],
    weak: ["clarify", "summarize", "concise", "professional", "polished"],
    minScore: 3,
  },

  research: {
    label: "Learning & Research",
    phrases: [
      "academic abstract",
      "literature review",
      "study guide",
      "research question",
      "explain like",
    ],
    strong: [
      "academic",
      "research",
      "study",
      "learn",
      "lesson",
      "explain",
      "summary",
      "summarize",
      "abstract",
      "paper",
      "article",
      "source",
      "notes",
      "concept",
      "definition",
      "quiz",
      "flashcards",
    ],
    weak: ["simplify", "breakdown", "overview", "interpret", "clarification"],
    minScore: 3,
  },

  productivity: {
    label: "Workflows & Productivity",
    phrases: ["standard operating procedure", "to-do list", "step by step"],
    strong: [
      "checklist",
      "workflow",
      "sop",
      "template",
      "process",
      "procedure",
      "steps",
      "operations",
      "ops",
      "system",
      "organize",
      "prioritize",
      "plan",
      "framework",
    ],
    weak: ["improve", "streamline", "efficient", "structure", "track"],
    minScore: 3,
  },

  planning: {
    label: "Planning & Events",
    phrases: ["run of show", "event plan", "meeting agenda"],
    strong: [
      "event",
      "agenda",
      "itinerary",
      "schedule",
      "conference",
      "wedding",
      "party",
      "meeting",
      "presentation",
      "speaker",
      "prep",
      "prepare",
      "planning",
      "timeline",
    ],
    weak: ["checklist", "coordination", "logistics", "setup"],
    minScore: 3,
  },

  data: {
    label: "Data & Finance",
    phrases: ["cash flow", "financial model", "valuation", "income statement"],
    strong: [
      "finance",
      "financial",
      "valuation",
      "model",
      "forecast",
      "budget",
      "pricing",
      "metrics",
      "kpi",
      "analysis",
      "analyze",
      "calculate",
      "spreadsheet",
      "roi",
      "profit",
      "revenue",
      "cost",
      "margin",
      "numbers",
      "data",
    ],
    weak: ["compare", "summary", "insights", "estimate", "projection"],
    minScore: 3,
  },

  marketing: {
    label: "Marketing & Growth",
    phrases: ["landing page", "value proposition", "ad copy", "seo keywords"],
    strong: [
      "marketing",
      "growth",
      "ads",
      "ad",
      "seo",
      "campaign",
      "landing",
      "positioning",
      "hook",
      "brand",
      "audience",
      "offer",
      "conversion",
      "cta",
      "newsletter",
      "social",
      "content strategy",
    ],
    weak: ["headline", "pitch", "post", "copy", "optimize"],
    minScore: 3,
  },

  creative: {
    label: "Creative & Media",
    phrases: ["short story", "comic script", "character bio"],
    strong: [
      "creative",
      "story",
      "comic",
      "character",
      "plot",
      "scene",
      "dialogue",
      "poem",
      "lyrics",
      "name",
      "brainstorm",
      "ideas",
      "prompt",
      "worldbuilding",
    ],
    weak: ["style", "voice", "funny", "humor", "generate"],
    minScore: 3,
  },

  compliance: {
    label: "Policy & Professional",
    phrases: ["terms of service", "privacy policy", "risk assessment"],
    strong: [
      "policy",
      "compliance",
      "legal",
      "terms",
      "privacy",
      "disclaimer",
      "guidelines",
      "risk",
      "security",
      "hr",
      "regulation",
      "contract",
    ],
    weak: ["professional", "formal", "review", "safe"],
    minScore: 3,
  },
};

function normalize(text: string) {
  return (text || "")
    .toLowerCase()
    .replace(/[\u2019']/g, "'")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreCategory(haystack: string, categoryId: string) {
  const rule = CATEGORY_RULES[categoryId];
  if (!rule) return 0;

  let score = 0;
  for (const p of rule.phrases) if (haystack.includes(p)) score += 4;
  for (const kw of rule.strong) if (kw && haystack.includes(kw)) score += 2;
  for (const kw of rule.weak) if (kw && haystack.includes(kw)) score += 1;
  return score;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export default function ToolLibraryClient({ tools }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const qRaw = searchParams.get("q") || "";
  const query = normalize(qRaw);

  const category = searchParams.get("category") || "";
  const categoryLabel = CATEGORY_RULES[category]?.label;

  const sortParam = (searchParams.get("sort") || "title-az") as SortId;
  const sort: SortId =
    SORT_OPTIONS.find((s) => s.id === sortParam)?.id ?? "title-az";

  const pageParamRaw = searchParams.get("page") || "1";
  const pageParsed = Number.parseInt(pageParamRaw, 10);
  const requestedPage = Number.isFinite(pageParsed) && pageParsed > 0 ? pageParsed : 1;

  const setParam = (key: string, value?: string, resetPage = false) => {
    const current = new URLSearchParams(searchParams?.toString() || "");
    if (!value) current.delete(key);
    else current.set(key, value);
    if (resetPage) current.set("page", "1");

    const qs = current.toString();
    router.push(qs ? `/tools?${qs}` : "/tools", { scroll: true });
  };

  let filtered = tools;

  // Free-text search
  if (query) {
    filtered = filtered.filter((tool) => {
      const haystack = normalize(tool.title + " " + tool.description);
      return haystack.includes(query);
    });
  }

  // Category filter (scoring-based)
  if (category && category !== "all") {
    const rule = CATEGORY_RULES[category];
    if (rule) {
      filtered = filtered.filter((tool) => {
        const haystack = normalize(tool.title + " " + tool.description);
        return scoreCategory(haystack, category) >= rule.minScore;
      });
    }
  }

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const at = normalize(a.title);
    const bt = normalize(b.title);
    return sort === "title-az" ? at.localeCompare(bt) : bt.localeCompare(at);
  });

  // Pagination
  const totalFiltered = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PER_PAGE));
  const page = clamp(requestedPage, 1, totalPages);

  const start = (page - 1) * PER_PAGE;
  const end = start + PER_PAGE;
  const pageItems = sorted.slice(start, end);

  const showingFrom = totalFiltered === 0 ? 0 : start + 1;
  const showingTo = Math.min(end, totalFiltered);

  // Pagination window like Google-ish
  const getPageWindow = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

    const windowSize = 5; // center window
    const half = Math.floor(windowSize / 2);
    let left = page - half;
    let right = page + half;

    if (left < 2) {
      left = 2;
      right = left + windowSize - 1;
    }
    if (right > totalPages - 1) {
      right = totalPages - 1;
      left = right - windowSize + 1;
    }

    const mid = [];
    for (let p = left; p <= right; p++) mid.push(p);

    return [1, ...mid, totalPages];
  };

  const pageWindow = getPageWindow();

  const goPage = (p: number) => setParam("page", String(clamp(p, 1, totalPages)));

  return (
    <div>
      {/* Top line: status + sort only */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Status */}
          <div className="text-xs md:text-sm text-gray-400 flex flex-wrap items-center justify-center md:justify-start gap-2">
            <span>
              Showing{" "}
              <span className="text-purple-200 font-medium">
                {showingFrom}-{showingTo}
              </span>{" "}
              of{" "}
              <span className="text-purple-200 font-medium">{totalFiltered}</span>
            </span>

            {(qRaw.trim() || categoryLabel) && (
              <>
                <span className="hidden sm:inline-block text-gray-600">•</span>
                <span className="flex flex-wrap items-center gap-1">
                  {qRaw.trim() && (
                    <>
                      for
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs border border-white/10">
                        “{qRaw}”
                      </span>
                    </>
                  )}
                  {categoryLabel && (
                    <>
                      {qRaw.trim() ? "in" : "for"}
                      <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs border border-purple-400/40 text-purple-100">
                        {categoryLabel}
                      </span>
                    </>
                  )}
                </span>
              </>
            )}
          </div>

          {/* Sort */}
          <div className="flex items-center justify-center md:justify-end gap-2">
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setParam("sort", e.target.value, true)}
                className="appearance-none rounded-full bg-white/5 border border-white/10 text-gray-200 text-xs md:text-sm px-3 py-2 pr-9 hover:bg-white/10 hover:border-purple-400/40 transition"
                aria-label="Sort tools"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id} className="bg-[#020617]">
                    Sort: {o.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                ▾
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {totalFiltered === 0 && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-xs md:text-sm text-gray-400">
          No tools match your current filters.
          <div className="mt-2">
            Try clearing the search, picking a different category, or browsing all tools.
          </div>
        </div>
      )}

      {/* Grid */}
      {totalFiltered > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mt-4">
          {pageItems.map((tool) => (
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

      {/* ✅ Bottom-centered pagination (Google-ish) */}
      {totalFiltered > 0 && totalPages > 1 && (
        <div className="mt-10 flex flex-col items-center justify-center gap-3">
          <div className="text-xs md:text-sm text-gray-400">
            Showing:{" "}
            <span className="text-purple-200 font-medium">
              {showingFrom}-{showingTo}
            </span>{" "}
            of <span className="text-purple-200 font-medium">{totalFiltered}</span>
          </div>

          <nav
            className="flex items-center justify-center gap-1.5"
            aria-label="Pagination"
          >
            {/* Prev */}
            <button
              type="button"
              onClick={() => goPage(page - 1)}
              disabled={page <= 1}
              className="h-9 w-9 grid place-items-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-400/40 transition disabled:opacity-40 disabled:hover:bg-white/5 disabled:hover:border-white/10"
              aria-label="Previous page"
            >
              ‹
            </button>

            {/* Pages */}
            {pageWindow.map((p, idx) => {
              const prev = pageWindow[idx - 1];
              const gap = prev && p - prev > 1;

              return (
                <span key={p} className="flex items-center gap-1.5">
                  {gap && (
                    <span className="px-1 text-gray-500 select-none">…</span>
                  )}

                  <button
                    type="button"
                    onClick={() => goPage(p)}
                    aria-current={p === page ? "page" : undefined}
                    className={
                      p === page
                        ? "h-9 w-9 rounded-xl bg-white/10 border border-white/10 text-white text-sm font-medium"
                        : "h-9 w-9 rounded-xl bg-transparent border border-transparent text-gray-300 text-sm hover:bg-white/5 hover:border-white/10 transition"
                    }
                  >
                    {p}
                  </button>
                </span>
              );
            })}

            {/* Next */}
            <button
              type="button"
              onClick={() => goPage(page + 1)}
              disabled={page >= totalPages}
              className="h-9 w-9 grid place-items-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-400/40 transition disabled:opacity-40 disabled:hover:bg-white/5 disabled:hover:border-white/10"
              aria-label="Next page"
            >
              ›
            </button>
          </nav>

          {/* Small UX improvement: jump to top on page change */}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="mt-1 text-[11px] text-gray-500 hover:text-gray-300 transition"
          >
            Back to top ↑
          </button>
        </div>
      )}
    </div>
  );
}
