"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Category = {
  id: string;
  label: string;
  description: string;
};

const CATEGORIES: Category[] = [
  {
    id: "writing",
    label: "Writing & Communication",
    description: "Emails, scripts, dialogue, and polished wording.",
  },
  {
    id: "education",
    label: "Learning & Research",
    description: "Academic abstracts, study helpers, and explanations.",
  },
  {
    id: "business",
    label: "Business & Operations",
    description: "Checklists, planning, and structured workflows.",
  },
  {
    id: "events",
    label: "Events & Planning",
    description: "Event agendas, checklists, and preparation tools.",
  },
  {
    id: "creative",
    label: "Creative & Media",
    description: "Stories, creative prompts, comics, and content.",
  },
  {
    id: "all",
    label: "Show all tools",
    description: "Clear category filters and browse everything.",
  },
];

export default function CategoryPicker() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSelect = (category: Category) => {
    const current = new URLSearchParams(searchParams?.toString() || "");

    if (category.id === "all") {
      current.delete("category");
    } else {
      current.set("category", category.id);
    }

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
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelect(cat)}
                    className="group text-left rounded-2xl border border-white/10 bg-white/5 hover:bg-purple-500/10 hover:border-purple-400/60 transition duration-200 p-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-sm md:text-base font-medium">
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
                  </button>
                ))}
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
