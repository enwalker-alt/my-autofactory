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
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-8 bg-black/70 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl rounded-3xl border border-white/10 bg-[#020617]/95 shadow-2xl shadow-purple-900/50">
            {/* Close button */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded-full bg-white/5 px-2 py-1 text-xs text-gray-300 hover:bg-white/10"
              aria-label="Close"
            >
              ✕
            </button>

            <div className="px-6 pt-6 pb-5 md:px-8 md:pt-7 md:pb-6">
              <h2 className="text-lg md:text-xl font-semibold mb-1">
                Find the right tool faster
              </h2>
              <p className="text-xs md:text-sm text-gray-400 mb-5">
                Start with what you&apos;re trying to do. We&apos;ll narrow the
                library for you using smart category filters.
              </p>

              {/* Category grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.Icon;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleSelect(cat)}
                      className="group text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-purple-500/10 hover:border-purple-400/60 transition duration-200 p-4 flex flex-col justify-between"
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon bubble */}
                        <div className="shrink-0 mt-0.5 h-9 w-9 rounded-xl border border-white/10 bg-white/5 grid place-items-center group-hover:border-purple-400/50 group-hover:bg-purple-500/10 transition">
                          <Icon className="h-4.5 w-4.5 text-purple-200/90 group-hover:text-purple-100" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm md:text-base font-medium truncate">
                              {cat.label}
                            </span>
                            <span className="text-[10px] uppercase tracking-wide text-purple-300/80 group-hover:text-purple-200">
                              {cat.id === "all" ? "All tools" : "Category"}
                            </span>
                          </div>
                          <p className="text-xs md:text-sm text-gray-400">
                            {cat.description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <p className="mt-4 text-[11px] text-gray-500">
                Tip: you can still type in the search bar after choosing a
                category to laser-focus the results.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
