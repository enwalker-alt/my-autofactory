"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  PenLine,
  BookOpen,
  Briefcase,
  CalendarDays,
  Sparkles,
  BarChart3,
  Megaphone,
  ShieldCheck,
  LayoutGrid,
} from "lucide-react";

type Category = {
  id: string;
  label: string;
  description: string;
  Icon: LucideIcon;
};

const CATEGORIES: Category[] = [
  {
    id: "writing",
    label: "Writing & Messaging",
    description: "Emails, rewrites, tone fixes, scripts, and clarity upgrades.",
    Icon: PenLine,
  },
  {
    id: "research",
    label: "Learning & Research",
    description: "Explain concepts, summarize sources, study help, Q&A support.",
    Icon: BookOpen,
  },
  {
    id: "productivity",
    label: "Workflows & Productivity",
    description: "Checklists, SOPs, templates, decision helpers, time savers.",
    Icon: Briefcase,
  },
  {
    id: "planning",
    label: "Planning & Events",
    description: "Agendas, itineraries, preparation plans, and run-of-show docs.",
    Icon: CalendarDays,
  },
  {
    id: "data",
    label: "Data & Finance",
    description: "Numbers, analysis, comparisons, summaries, and structured output.",
    Icon: BarChart3,
  },
  {
    id: "marketing",
    label: "Marketing & Growth",
    description: "Ads, landing copy, positioning, hooks, and content strategy.",
    Icon: Megaphone,
  },
  {
    id: "creative",
    label: "Creative & Media",
    description: "Stories, prompts, social content, names, and idea generation.",
    Icon: Sparkles,
  },
  {
    id: "compliance",
    label: "Policy & Professional",
    description: "Safer wording, formal templates, and admin-style documentation.",
    Icon: ShieldCheck,
  },
  {
    id: "all",
    label: "Show all tools",
    description: "Clear category filters and browse everything.",
    Icon: LayoutGrid,
  },
];

export default function CategoryPicker() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSelect = (category: Category) => {
    const current = new URLSearchParams(searchParams?.toString() || "");

    if (category.id === "all") current.delete("category");
    else current.set("category", category.id);

    const queryString = current.toString();
    const href = queryString ? `/tools?${queryString}` : "/tools";

    router.push(href, { scroll: true });
    setOpen(false);
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs md:text-sm font-medium bg-white/5 border border-white/10 hover:bg-white/10 hover:border-purple-400/40 transition duration-200 shadow-sm shadow-purple-900/40"
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.9)]" />
        Browse by category
      </button>

      {/* Overlay + Modal */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          {/* Center on desktop, bottom-sheet on mobile */}
          <div className="absolute inset-0 flex items-end sm:items-center justify-center p-3 sm:p-4">
            <div className="relative w-full max-w-3xl rounded-2xl sm:rounded-3xl border border-white/10 bg-[#020617]/95 shadow-2xl shadow-purple-900/50 overflow-hidden">
              {/* Scroll container so it fits on phones */}
              <div className="max-h-[88vh] sm:max-h-[85vh] overflow-y-auto overscroll-contain">
                {/* Sticky header (so close is always visible) */}
                <div className="sticky top-0 z-10 border-b border-white/10 bg-[#020617]/95 backdrop-blur">
                  <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base sm:text-lg md:text-xl font-semibold leading-snug">
                        Find the right tool faster
                      </h2>
                      <p className="mt-1 text-[11px] sm:text-xs md:text-sm text-gray-400">
                        Pick a category to filter the library instantly.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="shrink-0 rounded-full bg-white/5 px-2.5 py-1.5 text-xs text-gray-300 hover:bg-white/10"
                      aria-label="Close"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="px-4 sm:px-6 pb-4 sm:pb-6 pt-3 sm:pt-4">
                  {/* Category grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 md:gap-4">
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.Icon;

                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleSelect(cat)}
                          className="group text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-purple-500/10 hover:border-purple-400/60 transition duration-200 p-3 sm:p-4 flex flex-col justify-between"
                        >
                          <div className="flex items-start gap-3">
                            {/* Icon bubble */}
                            <div className="shrink-0 mt-0.5 h-9 w-9 rounded-xl border border-white/10 bg-white/5 grid place-items-center group-hover:border-purple-400/50 group-hover:bg-purple-500/10 transition">
                              <Icon className="h-4 w-4 text-purple-200/90 group-hover:text-purple-100" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-sm sm:text-base font-medium truncate">
                                  {cat.label}
                                </span>
                                <span className="text-[10px] uppercase tracking-wide text-purple-300/80 group-hover:text-purple-200">
                                  {cat.id === "all" ? "All tools" : "Category"}
                                </span>
                              </div>

                              {/* On phones, keep it compact: show a shorter description */}
                              <p className="text-[11px] sm:text-sm text-gray-400 leading-snug">
                                <span className="sm:hidden">
                                  {cat.description}
                                </span>
                                <span className="hidden sm:inline">
                                  {cat.description}
                                </span>
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-3 sm:mt-4 text-[11px] text-gray-500">
                    Tip: you can still type in the search bar after choosing a
                    category to laser-focus the results.
                  </p>

                  {/* Mobile affordance: little grab handle look */}
                  <div className="sm:hidden mt-4 flex justify-center">
                    <div className="h-1 w-12 rounded-full bg-white/10" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tap outside to close */}
          <button
            type="button"
            aria-label="Close overlay"
            onClick={() => setOpen(false)}
            className="absolute inset-0 -z-10"
            tabIndex={-1}
          />
        </div>
      )}
    </>
  );
}
