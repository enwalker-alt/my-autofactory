"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  PenLine,
  Briefcase,
  BarChart3,
  Megaphone,
  CalendarDays,
  Sparkles,
  ShieldCheck,
  BookOpen,
  LayoutGrid,
  ChevronDown,
  X,
  Check,
} from "lucide-react";

type Category = {
  id: string;
  label: string;
  Icon: LucideIcon;
};

const CATEGORIES: Category[] = [
  { id: "writing", label: "Writing", Icon: PenLine },
  { id: "ops", label: "Operations", Icon: Briefcase },
  { id: "analysis", label: "Analysis", Icon: BarChart3 },
  { id: "marketing", label: "Marketing", Icon: Megaphone },
  { id: "planning", label: "Planning", Icon: CalendarDays },
  { id: "creative", label: "Creative", Icon: Sparkles },
  { id: "research", label: "Research", Icon: BookOpen },
  { id: "policy", label: "Policy", Icon: ShieldCheck },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function CategoryPicker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const currentCategoryId = searchParams.get("category") || "";
  const currentCategory = useMemo(() => {
    if (!currentCategoryId) return null;
    return CATEGORIES.find((c) => c.id === currentCategoryId) ?? null;
  }, [currentCategoryId]);

  // close on ESC
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const pushSelection = (categoryId: string) => {
    const current = new URLSearchParams(searchParams?.toString() || "");

    if (!categoryId) current.delete("category");
    else current.set("category", categoryId);

    current.set("page", "1");
    const qs = current.toString();
    router.push(qs ? `/tools?${qs}` : "/tools", { scroll: true });
  };

  const select = (categoryId: string) => {
    pushSelection(categoryId);
    setOpen(false);
  };

  const clear = () => select("");

  return (
    <>
      {/* Trigger — modern pill, cleaner hierarchy */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cx(
          "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs md:text-sm font-semibold transition",
          "bg-white/[0.04] border-white/10 hover:bg-white/[0.07] hover:border-white/20",
          "shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_10px_30px_rgba(0,0,0,0.35)]"
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
          <LayoutGrid className="h-3.5 w-3.5 text-slate-200/90" />
        </span>

        <span className="text-slate-100">Categories</span>

        <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-slate-200/75">
          {currentCategory ? currentCategory.label : "All"}
        </span>

        <ChevronDown className="h-4 w-4 text-slate-300/70" />
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="absolute inset-0 flex items-end sm:items-center justify-center p-3 sm:p-4">
            <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-[#050B1B]/95 shadow-2xl shadow-black/60">
              {/* Header — centered title, removed subtitle */}
              <div className="relative px-5 sm:px-6 py-4 border-b border-white/10">
                <div className="text-center">
                  <div className="text-base font-semibold text-slate-50">Categories</div>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/[0.04] p-2 text-slate-200/80 hover:bg-white/[0.08]"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-6">
                {/* “All tools” — more modern, slimmer */}
                <button
                  type="button"
                  onClick={clear}
                  className={cx(
                    "w-full rounded-2xl border px-4 py-3 flex items-center justify-between transition",
                    "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
                    !currentCategoryId
                      ? "border-purple-400/40 bg-gradient-to-r from-purple-500/12 to-cyan-500/5"
                      : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/20"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cx(
                        "h-10 w-10 rounded-xl border grid place-items-center",
                        !currentCategoryId
                          ? "border-purple-400/30 bg-purple-500/10"
                          : "border-white/10 bg-white/[0.04]"
                      )}
                    >
                      <LayoutGrid className="h-4 w-4 text-slate-200/90" />
                    </span>

                    <div className="text-left leading-tight">
                      <div className="text-sm font-semibold text-slate-50">All tools</div>
                      <div className="text-xs text-slate-400">No filter</div>
                    </div>
                  </div>

                  {!currentCategoryId ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-purple-400/30 bg-purple-500/10 px-2 py-1 text-[11px] text-purple-200">
                      <Check className="h-3.5 w-3.5" />
                      Selected
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Select</span>
                  )}
                </button>

                {/* Grid — softer shapes, cleaner spacing */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {CATEGORIES.map((cat) => {
                    const active = currentCategoryId === cat.id;
                    const Icon = cat.Icon;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => select(cat.id)}
                        className={cx(
                          "group rounded-2xl border p-3 text-left transition",
                          "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
                          active
                            ? "border-purple-400/40 bg-gradient-to-r from-purple-500/12 to-cyan-500/5"
                            : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/20"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={cx(
                              "h-10 w-10 rounded-xl border grid place-items-center shrink-0 transition",
                              active
                                ? "border-purple-400/30 bg-purple-500/10"
                                : "border-white/10 bg-white/[0.04] group-hover:bg-white/[0.07]"
                            )}
                          >
                            <Icon
                              className={cx(
                                "h-4 w-4 transition",
                                active ? "text-purple-100" : "text-slate-200/85 group-hover:text-slate-100"
                              )}
                            />
                          </span>

                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-50 truncate">{cat.label}</div>
                            {active && (
                              <div className="mt-0.5 text-[11px] text-purple-200">Selected</div>
                            )}
                          </div>

                          {active && (
                            <span className="ml-auto inline-flex items-center justify-center h-6 w-6 rounded-full border border-purple-400/30 bg-purple-500/10">
                              <Check className="h-3.5 w-3.5 text-purple-200" />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Footer — cleaner, more “premium” */}
                <div className="mt-5 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    Current:{" "}
                    <span className="text-slate-300">
                      {currentCategory ? currentCategory.label : "All tools"}
                    </span>
                  </div>

                  {currentCategory && (
                    <button
                      type="button"
                      onClick={clear}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-slate-200/90 hover:bg-white/[0.07] hover:border-white/20 transition"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Mobile affordance */}
              <div className="sm:hidden flex justify-center pb-3">
                <div className="h-1 w-12 rounded-full bg-white/10" />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
