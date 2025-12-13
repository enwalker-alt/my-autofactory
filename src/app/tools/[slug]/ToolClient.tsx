"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

type ToolMeta = {
  slug: string;
  title: string;
  description: string;
};

type Props = {
  tools: ToolMeta[];
  savedSlugs: string[];
  isSignedIn: boolean;
};

const PER_PAGE = 20;

const SORT_OPTIONS = [
  { id: "title-az", label: "A → Z" },
  { id: "title-za", label: "Z → A" },
] as const;

type SortId = (typeof SORT_OPTIONS)[number]["id"];

export default function ToolLibraryClient({
  tools,
  savedSlugs,
  isSignedIn,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // ✅ local saved state so the button updates instantly
  const [savedSet, setSavedSet] = useState<Set<string>>(
    () => new Set(savedSlugs)
  );

  // keep in sync if server refresh changes savedSlugs
  // (we only set if changed to avoid flicker)
  useMemo(() => {
    const next = new Set(savedSlugs);
    // simple sync: replace if sizes differ or any mismatch
    if (
      next.size !== savedSet.size ||
      Array.from(next).some((x) => !savedSet.has(x))
    ) {
      setSavedSet(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSlugs]);

  const q = sp.get("q")?.trim().toLowerCase() ?? "";
  const sortId = (sp.get("sort") as SortId) ?? "title-az";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);

  const filtered = useMemo(() => {
    let list = tools;

    if (q) {
      list = list.filter((t) => {
        const hay = `${t.title} ${t.description}`.toLowerCase();
        return hay.includes(q);
      });
    }

    const sorted = [...list].sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
    );

    if (sortId === "title-za") sorted.reverse();
    return sorted;
  }, [tools, q, sortId]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PER_PAGE;
  const pageItems = filtered.slice(start, start + PER_PAGE);

  function setQueryParam(key: string, value?: string) {
    const next = new URLSearchParams(sp.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    // reset paging when changing filters/sort/search
    if (key !== "page") next.delete("page");
    const qs = next.toString();
    router.push(qs ? `/tools?${qs}` : "/tools");
  }

  async function toggleSave(slug: string) {
    if (!isSignedIn) {
      await signIn("google", { callbackUrl: `/tools` });
      return;
    }

    // optimistic UI
    const wasSaved = savedSet.has(slug);
    setSavedSet((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(slug);
      else next.add(slug);
      return next;
    });

    try {
      const res = await fetch(`/api/tools/${slug}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (res.status === 401) {
        // revert optimistic
        setSavedSet((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(slug);
          else next.delete(slug);
          return next;
        });
        await signIn("google", { callbackUrl: `/tools` });
        return;
      }

      if (!res.ok) {
        // revert optimistic
        setSavedSet((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(slug);
          else next.delete(slug);
          return next;
        });
        return;
      }

      const data = (await res.json()) as { saved?: boolean };
      if (typeof data.saved === "boolean") {
        setSavedSet((prev) => {
          const next = new Set(prev);
          if (data.saved) next.add(slug);
          else next.delete(slug);
          return next;
        });
      }

      // ✅ refresh server components so Saved count + savedSlugs update
      startTransition(() => {
        router.refresh();
      });
    } catch {
      // revert optimistic on network error
      setSavedSet((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(slug);
        else next.delete(slug);
        return next;
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* top row: showing + sort */}
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs text-slate-300/80">
          Showing {total === 0 ? 0 : start + 1}-{Math.min(start + PER_PAGE, total)}{" "}
          of {total}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300/70">Sort:</span>
          <select
            value={sortId}
            onChange={(e) => setQueryParam("sort", e.target.value)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 backdrop-blur hover:bg-white/10"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* grid */}
      {pageItems.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-slate-300/80">
          No tools match your current filters.
          <div className="mt-2 text-xs text-slate-400">
            Try clearing the search, picking a different category, or browsing all tools.
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pageItems.map((t) => {
            const saved = savedSet.has(t.slug);
            return (
              <div
                key={t.slug}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur hover:bg-white/7 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      {t.title}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-300/80">
                      {t.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleSave(t.slug)}
                    disabled={isPending}
                    className={[
                      "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                      saved
                        ? "border-purple-400/40 bg-purple-500/15 text-purple-100 hover:bg-purple-500/20"
                        : "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10",
                      isPending ? "opacity-70 cursor-not-allowed" : "",
                    ].join(" ")}
                    title={saved ? "Remove from saved" : "Save this tool"}
                  >
                    {saved ? "Saved ✓" : "Save"}
                  </button>
                </div>

                <div className="mt-4">
                  <Link
                    href={`/tools/${t.slug}`}
                    className="text-xs font-semibold text-purple-200/90 hover:text-purple-200"
                  >
                    Open tool →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setQueryParam("page", String(Math.max(1, safePage - 1)))}
            disabled={safePage <= 1}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 hover:bg-white/10 disabled:opacity-50"
          >
            Prev
          </button>

          <div className="text-xs text-slate-300/80">
            Page {safePage} / {totalPages}
          </div>

          <button
            type="button"
            onClick={() =>
              setQueryParam("page", String(Math.min(totalPages, safePage + 1)))
            }
            disabled={safePage >= totalPages}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 hover:bg-white/10 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
