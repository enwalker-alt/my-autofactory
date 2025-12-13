"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { signIn } from "next-auth/react";

type ToolMeta = {
  slug: string;
  title: string;
  description: string;

  // support either naming (prevents mismatches from breaking UI)
  avgRating?: number | null;
  ratingAvg?: number | null;

  ratingCount?: number | null;
};

type Props = {
  tools: ToolMeta[];
  savedSlugs: string[];
  isSignedIn: boolean;
};

const PER_PAGE = 20;

const SORT_OPTIONS = [
  { id: "rating-high", label: "Rating: High → Low" },
  { id: "rating-low", label: "Rating: Low → High" },
  { id: "title-az", label: "A → Z" },
  { id: "title-za", label: "Z → A" },
] as const;

type SortId = (typeof SORT_OPTIONS)[number]["id"];

// ... keep your CATEGORY_RULES exactly as-is (unchanged)
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

function StarsInline({
  value,
  count,
}: {
  value?: number | null;
  count?: number | null;
}) {
  const v = typeof value === "number" ? value : 0;
  const c = typeof count === "number" ? count : 0;

  const rounded = Math.round(v * 10) / 10;
  const full = Math.floor(rounded);
  const half = rounded - full >= 0.5;

  return (
    <div className="flex items-center gap-2 text-[12px] text-slate-300">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const isFull = n <= full;
          const isHalf = !isFull && half && n === full + 1;
          return (
            <span
              key={n}
              className={
                isFull || isHalf ? "text-yellow-300/90" : "text-slate-600"
              }
              aria-hidden="true"
            >
              ★
            </span>
          );
        })}
      </div>

      <span className="text-slate-400">
        {c > 0 ? `${rounded.toFixed(1)} (${c})` : "No ratings"}
      </span>
    </div>
  );
}

export default function ToolLibraryClient({ tools, savedSlugs, isSignedIn }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [localSaved, setLocalSaved] = useState<Set<string>>(
    () => new Set(savedSlugs)
  );

  useEffect(() => {
    setLocalSaved(new Set(savedSlugs));
  }, [savedSlugs]);

  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const statusTimer = useRef<number | null>(null);

  function flashStatus(msg: string) {
    setSaveStatus(msg);
    if (statusTimer.current) window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setSaveStatus(null), 3500);
  }

  const savedOn = searchParams.get("saved") === "1";

  const qRaw = searchParams.get("q") || "";
  const query = normalize(qRaw);

  const category = searchParams.get("category") || "";
  const categoryLabel = CATEGORY_RULES[category]?.label;

  const sortParam = (searchParams.get("sort") || "rating-high") as SortId;
  const sort: SortId =
    SORT_OPTIONS.find((s) => s.id === sortParam)?.id ?? "rating-high";

  const pageParamRaw = searchParams.get("page") || "1";
  const pageParsed = Number.parseInt(pageParamRaw, 10);
  const requestedPage =
    Number.isFinite(pageParsed) && pageParsed > 0 ? pageParsed : 1;

  const setParam = (key: string, value?: string, resetPage = false) => {
    const current = new URLSearchParams(searchParams?.toString() || "");
    if (!value) current.delete(key);
    else current.set(key, value);
    if (resetPage) current.set("page", "1");

    const qs = current.toString();
    router.push(qs ? `/tools?${qs}` : "/tools", { scroll: true });
  };

  async function toggleSave(slug: string) {
    if (!isSignedIn) {
      flashStatus("Sign in required to save.");
      await signIn("google", { callbackUrl: "/tools" });
      return;
    }

    const wasSaved = localSaved.has(slug);

    setLocalSaved((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(slug);
      else next.add(slug);
      return next;
    });

    try {
      const res = await fetch(`/api/tools/${slug}/save`, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
      });

      let bodyText = "";
      let bodyJson: any = null;

      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        try {
          bodyJson = await res.json();
        } catch {
          bodyJson = null;
        }
      } else {
        try {
          bodyText = await res.text();
        } catch {
          bodyText = "";
        }
      }

      if (!res.ok) {
        console.error("Save failed:", { status: res.status, slug, bodyJson, bodyText });

        setLocalSaved((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(slug);
          else next.delete(slug);
          return next;
        });

        if (res.status === 401) {
          flashStatus("401 Unauthorized — session not being sent.");
          await signIn("google", { callbackUrl: "/tools" });
          return;
        }

        flashStatus(`Save failed (${res.status}). Check console.`);
        return;
      }

      const savedValue =
        typeof bodyJson?.saved === "boolean" ? (bodyJson.saved as boolean) : !wasSaved;

      setLocalSaved((prev) => {
        const next = new Set(prev);
        if (savedValue) next.add(slug);
        else next.delete(slug);
        return next;
      });

      flashStatus(savedValue ? "Saved ✅" : "Unsaved ✅");
      startTransition(() => router.refresh());
    } catch (err) {
      console.error("Save network error:", err);

      setLocalSaved((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(slug);
        else next.delete(slug);
        return next;
      });

      flashStatus("Network error — check console.");
    }
  }

  let filtered = tools;

  if (savedOn) {
    if (!isSignedIn) filtered = [];
    else filtered = filtered.filter((t) => localSaved.has(t.slug));
  }

  if (query) {
    filtered = filtered.filter((tool) => {
      const haystack = normalize(tool.title + " " + tool.description);
      return haystack.includes(query);
    });
  }

  if (category && category !== "all") {
    const rule = CATEGORY_RULES[category];
    if (rule) {
      filtered = filtered.filter((tool) => {
        const haystack = normalize(tool.title + " " + tool.description);
        return scoreCategory(haystack, category) >= rule.minScore;
      });
    }
  }

  const getAvg = (t: ToolMeta) => {
    const v =
      typeof t.avgRating === "number"
        ? t.avgRating
        : typeof t.ratingAvg === "number"
          ? t.ratingAvg
          : 0;
    return v;
  };

  const getCount = (t: ToolMeta) => {
    return typeof t.ratingCount === "number" ? t.ratingCount : 0;
  };

  const sorted = [...filtered].sort((a, b) => {
    const ar = getAvg(a);
    const br = getAvg(b);
    const ac = getCount(a);
    const bc = getCount(b);

    if (sort === "rating-high") {
      if (br !== ar) return br - ar;
      if (bc !== ac) return bc - ac;
      return normalize(a.title).localeCompare(normalize(b.title));
    }

    if (sort === "rating-low") {
      if (ar !== br) return ar - br;
      if (ac !== bc) return ac - bc;
      return normalize(a.title).localeCompare(normalize(b.title));
    }

    const at = normalize(a.title);
    const bt = normalize(b.title);
    return sort === "title-az" ? at.localeCompare(bt) : bt.localeCompare(at);
  });

  const totalFiltered = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PER_PAGE));
  const page = clamp(requestedPage, 1, totalPages);

  const start = (page - 1) * PER_PAGE;
  const end = start + PER_PAGE;
  const pageItems = sorted.slice(start, end);

  const showingFrom = totalFiltered === 0 ? 0 : start + 1;
  const showingTo = Math.min(end, totalFiltered);

  return (
    <div>
      {saveStatus && (
        <div className="mb-4 flex justify-center">
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-gray-200">
            {saveStatus}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-xs md:text-sm text-gray-400 flex flex-wrap items-center justify-center md:justify-start gap-2">
            <span>
              Showing{" "}
              <span className="text-purple-200 font-medium">
                {showingFrom}-{showingTo}
              </span>{" "}
              of <span className="text-purple-200 font-medium">{totalFiltered}</span>
            </span>

            {(qRaw.trim() || categoryLabel || savedOn) && (
              <>
                <span className="hidden sm:inline-block text-gray-600">•</span>
                <span className="flex flex-wrap items-center gap-1">
                  {savedOn && (
                    <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs border border-purple-400/40 text-purple-100">
                      Saved
                    </span>
                  )}
                  {qRaw.trim() && (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs border border-white/10">
                      “{qRaw}”
                    </span>
                  )}
                  {categoryLabel && (
                    <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs border border-purple-400/40 text-purple-100">
                      {categoryLabel}
                    </span>
                  )}
                </span>
              </>
            )}
          </div>

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

      {totalFiltered === 0 && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-xs md:text-sm text-gray-400">
          No tools match your current filters.
          <div className="mt-2">
            Try clearing the search, picking a different category, or browsing all tools.
          </div>
        </div>
      )}

      {totalFiltered > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mt-4">
          {pageItems.map((tool) => {
            const isSaved = localSaved.has(tool.slug);
            const avg = (typeof tool.avgRating === "number"
              ? tool.avgRating
              : typeof tool.ratingAvg === "number"
                ? tool.ratingAvg
                : 0) as number;

            return (
              <Link
                key={tool.slug}
                href={`/tools/${tool.slug}`}
                className="group rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-400/40 transition duration-200 p-4 flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-sm md:text-base font-medium mb-1 group-hover:text-white truncate">
                      {tool.title}
                    </h2>

                    <div className="mb-2">
                      <StarsInline value={avg} count={tool.ratingCount} />
                    </div>

                    <p className="text-xs md:text-sm text-gray-400 line-clamp-3">
                      {tool.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleSave(tool.slug);
                    }}
                    disabled={isPending}
                    className={
                      isSaved
                        ? "shrink-0 rounded-full border border-purple-400/40 bg-purple-500/15 px-3 py-1 text-[11px] text-purple-100 hover:bg-purple-500/20 transition disabled:opacity-60"
                        : "shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-gray-200 hover:bg-white/10 hover:border-purple-400/40 transition disabled:opacity-60"
                    }
                    aria-label={isSaved ? "Unsave tool" : "Save tool"}
                    title={isSaved ? "Saved" : "Save"}
                  >
                    {isSaved ? "Saved ✓" : "Save"}
                  </button>
                </div>

                <div className="mt-3 text-[11px] text-purple-300/90 group-hover:text-purple-200">
                  Open tool →
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
