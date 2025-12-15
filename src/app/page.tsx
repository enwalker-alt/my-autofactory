"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import {
  UploadCloud,
  Sparkles,
  Wand2,
  Bookmark,
  ArrowDown,
  PenLine,
  ClipboardList,
  CalendarDays,
  ShieldCheck,
  BarChart3,
  Megaphone,
  Briefcase,
  BookOpen,
  LayoutGrid,
} from "lucide-react";

type Mode = "wander" | "inspect-title" | "slide-edge";

type ToolMeta = {
  slug: string;
  title: string;
  description: string;
  avgRating?: number | null;
  ratingCount?: number | null;
};

function AuthPill() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  const user = session?.user;
  const name = user?.name || "Signed in";
  const email = user?.email || "";
  const image = user?.image || "";

  return (
    <div className="relative" ref={menuRef}>
      {status !== "authenticated" ? (
        <button
          onClick={() => signIn("google", { callbackUrl: "/tools" })}
          className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-100 backdrop-blur-xl shadow-[0_0_40px_rgba(15,23,42,0.65)] transition hover:border-cyan-300/40 hover:bg-white/10 hover:shadow-[0_0_60px_rgba(34,211,238,0.25)]"
        >
          <span className="relative inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-fuchsia-500 via-violet-500 to-cyan-300 shadow-sm shadow-fuchsia-500/20">
            <span className="absolute inset-[2px] rounded-full bg-slate-950/60" />
            <span className="relative text-[0.7rem] font-bold tracking-tight">A</span>
          </span>
          <span className="opacity-90 group-hover:opacity-100">
            Sign in
            <span className="ml-2 rounded-full bg-white/10 px-2 py-1 text-[0.65rem] font-medium text-slate-200">
              Google
            </span>
          </span>
        </button>
      ) : (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 backdrop-blur-xl shadow-[0_0_40px_rgba(15,23,42,0.65)] transition hover:border-white/20 hover:bg-white/10"
            aria-label="Account menu"
          >
            <span className="relative h-7 w-7 overflow-hidden rounded-full border border-white/10 bg-white/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {image ? (
                <img
                  src={image}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-gradient-to-tr from-fuchsia-500 via-violet-500 to-cyan-300 text-[0.7rem] font-bold text-slate-950">
                  {(name?.[0] || "U").toUpperCase()}
                </span>
              )}
            </span>

            <span className="hidden max-w-[160px] truncate text-slate-100/90 sm:block">{name}</span>

            <span
              className={`ml-1 inline-flex h-2 w-2 rounded-full ${
                !user ? "animate-pulse bg-slate-400" : "bg-emerald-400"
              }`}
              title={!user ? "Loading" : "Online"}
            />
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-[280px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 shadow-[0_0_70px_rgba(0,0,0,0.8)] backdrop-blur-xl">
              <div className="p-4">
                <div className="text-sm font-semibold text-slate-100">{name}</div>
                {email ? (
                  <div className="mt-0.5 truncate text-xs text-slate-300">{email}</div>
                ) : (
                  <div className="mt-0.5 text-xs text-slate-400">Connected via Google</div>
                )}

                <div className="mt-3 grid gap-2">
                  <Link
                    href="/tools"
                    onClick={() => setOpen(false)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/10"
                  >
                    Go to Tools
                  </Link>

                  <button
                    onClick={() =>
                      signOut({
                        callbackUrl: "/",
                      })
                    }
                    className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-left text-xs font-semibold text-rose-200 transition hover:border-rose-300/30 hover:bg-rose-500/15"
                  >
                    Sign out
                  </button>
                </div>

                <div className="mt-3 text-[0.65rem] text-slate-400">Atlas identity layer • v0</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stars({ value, count }: { value?: number | null; count?: number | null }) {
  const v = typeof value === "number" ? value : null;
  const c = typeof count === "number" ? count : null;

  if (v == null) {
    return <div className="text-[0.7rem] text-slate-400">New tool • be the first to rate</div>;
  }

  const full = Math.floor(v);
  const hasHalf = v - full >= 0.5;

  const stars = Array.from({ length: 5 }).map((_, i) => {
    const filled = i < full || (i === full && hasHalf);
    return (
      <span key={i} className={filled ? "text-amber-300" : "text-slate-600"}>
        ★
      </span>
    );
  });

  return (
    <div className="flex items-center gap-2 text-[0.7rem]">
      <div className="flex items-center gap-0.5">{stars}</div>
      <div className="text-slate-200/90">
        {v.toFixed(1)}
        <span className="text-slate-400">{c != null ? ` (${c})` : ""}</span>
      </div>
    </div>
  );
}

function pickToolIcon(title: string, description: string) {
  const s = `${title} ${description}`.toLowerCase();

  if (s.includes("email") || s.includes("rewrite") || s.includes("copy") || s.includes("tone")) return PenLine;
  if (s.includes("checklist") || s.includes("sop") || s.includes("steps") || s.includes("procedure")) return ClipboardList;
  if (s.includes("calendar") || s.includes("schedule") || s.includes("meeting") || s.includes("run of show")) return CalendarDays;
  if (s.includes("risk") || s.includes("compliance") || s.includes("audit") || s.includes("policy")) return ShieldCheck;
  if (s.includes("analysis") || s.includes("metrics") || s.includes("kpi") || s.includes("report")) return BarChart3;
  if (s.includes("marketing") || s.includes("headline") || s.includes("ad") || s.includes("positioning")) return Megaphone;
  if (s.includes("proposal") || s.includes("client") || s.includes("contract") || s.includes("business")) return Briefcase;
  if (s.includes("summary") || s.includes("notes") || s.includes("study") || s.includes("lecture")) return BookOpen;
  if (s.includes("template") || s.includes("format") || s.includes("layout")) return LayoutGrid;

  return Sparkles;
}

function ToolCardMini({ tool }: { tool: ToolMeta }) {
  const Icon = useMemo(() => pickToolIcon(tool.title, tool.description), [tool.title, tool.description]);

  return (
    <div className="atlasToolCard group rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_40px_rgba(15,23,42,0.9)] backdrop-blur-xl transition hover:-translate-y-[1px] hover:border-cyan-300/30 hover:bg-white/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200/90">
              <Icon className="h-4 w-4" />
            </span>
            <div className="truncate text-sm font-semibold text-slate-50">{tool.title}</div>
          </div>
          <div className="mt-1">
            <Stars value={tool.avgRating} count={tool.ratingCount} />
          </div>
        </div>

        <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.65rem] font-semibold text-slate-200/90">
          Tool
        </div>
      </div>

      <p className="mt-2 line-clamp-3 text-xs text-slate-300">{tool.description}</p>

      <div className="mt-3">
        <Link
          href={`/tools/${tool.slug}`}
          className="text-xs font-semibold text-cyan-200/90 transition hover:text-cyan-200"
        >
          Open tool →
        </Link>
      </div>
    </div>
  );
}

/** Horizontal, infinite auto-scroll carousel (hover to pause). */
function ToolCarousel({ compact = false }: { compact?: boolean }) {
  const [tools, setTools] = useState<ToolMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/tools", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch /api/tools");
        const json = await res.json();
        const list = Array.isArray(json) ? json : json?.tools;
        if (!cancelled) setTools(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setTools([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const loopTools = useMemo(() => {
    if (!tools.length) return [];
    return [...tools, ...tools];
  }, [tools]);

  return (
    <section className={compact ? "w-full" : "mt-12 w-full"}>
      <div className="mx-auto mb-4 flex w-full items-end justify-between gap-4 px-1">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">New tools shipping constantly</h3>
          <p className="mt-1 text-xs text-slate-300">Browse what Atlas is generating right now — scrolls forever.</p>
        </div>
        <Link
          href="/tools"
          className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-100 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10 sm:inline-flex"
        >
          Browse all →
        </Link>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-[0_0_60px_rgba(15,23,42,1)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-black/90 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-black/90 to-transparent" />

        <div className={compact ? "px-4 py-5 sm:px-5 sm:py-6" : "px-5 py-6"}>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="h-4 w-2/3 rounded bg-white/10" />
                  <div className="mt-3 h-3 w-1/2 rounded bg-white/10" />
                  <div className="mt-3 space-y-2">
                    <div className="h-3 w-full rounded bg-white/10" />
                    <div className="h-3 w-5/6 rounded bg-white/10" />
                    <div className="h-3 w-3/4 rounded bg-white/10" />
                  </div>
                </div>
              ))}
            </div>
          ) : tools.length ? (
            <div className="atlasMarquee">
              <div className="atlasMarqueeTrack">
                {loopTools.map((t, idx) => (
                  <ToolCardMini key={`${t.slug}-${idx}`} tool={t} />
                ))}
              </div>
            </div>
          ) : (
            <div className="px-1 py-2 text-sm text-slate-300">
              Couldn’t load tools.
              <div className="mt-3">
                <Link href="/tools" className="text-xs font-semibold text-cyan-200/90 hover:text-cyan-200">
                  Go to Tools →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 px-1 text-[0.7rem] text-slate-400">Tip: hover the carousel to pause.</p>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  desc,
  center = false,
  metricPill,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  center?: boolean;
  metricPill?: string;
}) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-slate-300">
          {eyebrow}
        </div>
        {metricPill ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-[0.65rem] font-semibold tracking-wide text-cyan-100">
            {metricPill}
          </div>
        ) : null}
      </div>
      <h2 className="mt-4 text-balance text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">{desc}</p>
    </div>
  );
}

function FeatureCard({ title, desc, kicker }: { title: string; desc: string; kicker?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_0_40px_rgba(15,23,42,0.9)] backdrop-blur-xl transition hover:-translate-y-[1px] hover:border-white/20 hover:bg-white/10">
      {kicker ? (
        <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.65rem] font-semibold text-slate-200/90">
          {kicker}
        </div>
      ) : null}
      <div className="text-sm font-semibold text-slate-50">{title}</div>
      <p className="mt-2 text-xs leading-relaxed text-slate-300">{desc}</p>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10">
      <div className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-300">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-50">{value}</div>
      <div className="mt-1 text-[0.75rem] text-slate-300">{sub}</div>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl open:bg-white/10">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-50">{q}</span>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[0.65rem] text-slate-200/80 transition group-open:rotate-180">
          ▾
        </span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">{a}</p>
    </details>
  );
}

function useRevealOnScroll() {
  const refs = useRef<HTMLElement[]>([]);
  const register = (el: HTMLElement | null) => {
    if (!el) return;
    if (!refs.current.includes(el)) refs.current.push(el);
  };

  useEffect(() => {
    const items = refs.current;
    if (!items.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add("reveal-in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.14, rootMargin: "0px 0px -10% 0px" }
    );

    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return register;
}

function formatInt(n: number) {
  try {
    return new Intl.NumberFormat("en-US").format(n);
  } catch {
    return String(n);
  }
}

/** ✅ Updated right-side hero cards: brighter interior + white text + remove dark inner wash */
function ProcessCard({
  toolsCount,
  avgRating,
  ratingCount,
}: {
  toolsCount: number;
  avgRating: number | null;
  ratingCount: number;
}) {
  const steps = [
    {
      Icon: UploadCloud,
      title: "Save your workflow",
      desc: "Describe your work (personal or business) so Atlas knows what “good” looks like.",
      glow: "from-fuchsia-500/25 via-violet-500/20 to-transparent",
      bar: "from-fuchsia-400 via-violet-300 to-cyan-200",
      iconBg: "from-fuchsia-500/25 via-violet-500/15 to-cyan-500/10",
      cardTint: "from-fuchsia-500/10 via-violet-500/6 to-white/6",
    },
    {
      Icon: Sparkles,
      title: "Get tool recommendations",
      desc: "Instant matches from the library for the jobs you do every week.",
      glow: "from-violet-500/25 via-fuchsia-500/15 to-transparent",
      bar: "from-violet-300 via-fuchsia-300 to-cyan-200",
      iconBg: "from-violet-500/25 via-fuchsia-500/15 to-cyan-500/10",
      cardTint: "from-violet-500/10 via-fuchsia-500/6 to-white/6",
    },
    {
      Icon: Wand2,
      title: "Receive new tools for you",
      desc: "Atlas generates new micro-tools based specifically on your workflow patterns.",
      glow: "from-cyan-500/25 via-violet-500/15 to-transparent",
      bar: "from-cyan-300 via-violet-300 to-fuchsia-300",
      iconBg: "from-cyan-500/25 via-violet-500/15 to-fuchsia-500/10",
      cardTint: "from-cyan-500/10 via-violet-500/6 to-white/6",
    },
  ] as const;

  return (
    <div className="relative">
      {/* header pills (no panel background) */}
      <div className="flex items-start justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.65rem] font-semibold text-slate-200/90 backdrop-blur-xl">
          How Atlas works
        </div>

        <div className="hidden items-center gap-2 text-[0.65rem] text-slate-300 sm:flex">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-xl">
            {toolsCount ? `${formatInt(toolsCount)} tools` : "Tools"}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-emerald-400/90" />
            {avgRating ? `${avgRating.toFixed(1)} avg` : "New"}
            <span className="text-slate-400">{ratingCount ? ` • ${formatInt(ratingCount)}` : ""}</span>
          </span>
        </div>
      </div>

      <div className="relative mt-4 grid gap-3">
        {steps.map((s, idx) => {
          const Icon = s.Icon;

          return (
            <div key={s.title} className="relative">
              {/* glow belongs to THIS card only */}
              <div className={`pointer-events-none absolute -inset-6 rounded-[2rem] bg-gradient-to-r ${s.glow} blur-2xl`} />
              <div
                className={`pointer-events-none absolute -inset-3 rounded-[1.75rem] bg-gradient-to-r ${s.glow} blur-xl opacity-70`}
              />

              <div
                className={[
                  "group relative overflow-hidden rounded-2xl border border-white/12",
                  "bg-gradient-to-br",
                  s.cardTint,
                  "px-5 py-5 shadow-[0_0_50px_rgba(15,23,42,0.65)] backdrop-blur-xl",
                  "transition hover:-translate-y-[1px] hover:border-white/22 hover:shadow-[0_0_70px_rgba(15,23,42,0.8)]",
                ].join(" ")}
              >
                {/* ✅ remove the dark internal wash that was dimming text */}
                {/* left color bar */}
                <div className={`pointer-events-none absolute inset-y-0 left-0 w-[6px] bg-gradient-to-b ${s.bar}`} />

                {/* subtle highlight sheen (bright, not dark) */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-transparent" />

                <div className="relative flex items-center gap-4">
                  <span
                    className={`relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-gradient-to-tr ${s.iconBg} text-white shadow-sm`}
                  >
                    <span className="absolute inset-[1px] rounded-2xl bg-black/20" />
                    <Icon className="relative h-5 w-5" />
                  </span>

                  <div className="min-w-0">
                    <div className="text-base font-semibold tracking-tight text-white sm:text-lg">{s.title}</div>
                    <div className="mt-1 text-xs leading-relaxed text-white/75">{s.desc}</div>
                  </div>
                </div>
              </div>

              {/* down arrow between cards */}
              {idx < steps.length - 1 ? (
                <div className="my-2 flex items-center justify-center">
                  <div className="relative">
                    <div className="pointer-events-none absolute -inset-3 rounded-full bg-gradient-to-r from-fuchsia-500/20 via-violet-500/15 to-cyan-500/20 blur-xl" />
                    <span className="relative inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 p-2 text-slate-200/90 backdrop-blur-xl">
                      <ArrowDown className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="relative mt-5 flex gap-2">
        <Link
          href="/tools"
          className="flex-1 rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 px-4 py-2 text-center text-xs font-semibold text-slate-950 shadow-lg shadow-fuchsia-500/20 transition hover:translate-y-0.5 hover:shadow-xl"
        >
          Explore tools →
        </Link>
        <Link
          href="/tools?saved=1"
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-500/10 px-4 py-2 text-center text-xs font-semibold text-cyan-100 backdrop-blur-xl transition hover:border-cyan-200/30 hover:bg-cyan-500/15"
        >
          <Bookmark className="h-4 w-4" />
          Saved tools
        </Link>
      </div>

      <div className="relative mt-3 text-[0.7rem] text-slate-400">Tip: sign in to save tools and build your stack.</div>
    </div>
  );
}

export default function HomePage() {
  const orbRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);

  const viewportRef = useRef({ width: 1280, height: 720 });
  const titleTargetRef = useRef({ x: 0, y: 0 });

  const mouseRef = useRef<{ x: number; y: number; active: boolean; lastMove: number }>({
    x: 0,
    y: 0,
    active: false,
    lastMove: 0,
  });

  // header/progress polish
  const [scrolled, setScrolled] = useState(false);
  const [scrollP, setScrollP] = useState(0);

  // metrics (pulled from /api/tools)
  const [metrics, setMetrics] = useState<{
    toolsCount: number;
    avgRating: number | null;
    ratingCount: number;
    ratedTools: number;
  }>({
    toolsCount: 0,
    avgRating: null,
    ratingCount: 0,
    ratedTools: 0,
  });

  const reveal = useRevealOnScroll();

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || 0;
      setScrolled(y > 12);

      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - doc.clientHeight);
      const p = Math.max(0, Math.min(1, y / max));
      setScrollP(p);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMetrics() {
      try {
        const res = await fetch("/api/tools", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed metrics");
        const json = await res.json();
        const list: ToolMeta[] = Array.isArray(json) ? json : json?.tools;
        const tools = Array.isArray(list) ? list : [];

        const rated = tools.filter((t) => typeof t.avgRating === "number" && typeof t.ratingCount === "number");
        const ratingCount = rated.reduce((sum, t) => sum + (t.ratingCount || 0), 0);

        const weighted =
          ratingCount > 0
            ? rated.reduce((sum, t) => sum + (t.avgRating || 0) * (t.ratingCount || 0), 0) / ratingCount
            : null;

        if (!cancelled) {
          setMetrics({
            toolsCount: tools.length,
            avgRating: weighted,
            ratingCount,
            ratedTools: rated.length,
          });
        }
      } catch {
        if (!cancelled) {
          setMetrics((m) => ({ ...m }));
        }
      }
    }

    loadMetrics();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const updateViewport = () => {
      if (typeof window === "undefined") return;
      viewportRef.current.width = window.innerWidth;
      viewportRef.current.height = window.innerHeight;

      if (titleRef.current) {
        const rect = titleRef.current.getBoundingClientRect();
        titleTargetRef.current = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      }
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);

    const { width, height } = viewportRef.current;

    const state: {
      x: number;
      y: number;
      t: number;
      mode: Mode;
      modeTime: number;
      slideEdge: "top" | "bottom" | "left" | "right";
    } = {
      x: width / 2,
      y: height * 0.55,
      t: 0,
      mode: "wander",
      modeTime: 0,
      slideEdge: "bottom",
    };

    const chooseEdge = () => {
      const edges: Array<"top" | "bottom" | "left" | "right"> = ["top", "bottom", "left", "right"];
      state.slideEdge = edges[Math.floor(Math.random() * edges.length)];
    };

    const setMode = (mode: Mode) => {
      state.mode = mode;
      state.modeTime = 0;
      if (mode === "slide-edge") chooseEdge();
    };

    let frameId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      frameId = requestAnimationFrame(loop);
      const dt = Math.min((now - lastTime) / 1000, 0.033);
      lastTime = now;

      state.t += dt;
      state.modeTime += dt;

      const { width, height } = viewportRef.current;
      const margin = 60;
      const centerX = width / 2;
      const centerY = height * 0.55;

      const mouse = mouseRef.current;
      const mouseRecentlyActive = mouse.active && now - mouse.lastMove < 2000 && mouse.x !== 0;

      if (state.mode === "wander" && state.modeTime > 7) {
        const r = Math.random();
        if (r < 0.3) setMode("inspect-title");
        else if (r < 0.6) setMode("slide-edge");
        else if (state.modeTime > 16) state.modeTime = 0;
      } else if (state.mode === "inspect-title" && state.modeTime > 6) {
        setMode("wander");
      } else if (state.mode === "slide-edge" && state.modeTime > 8.5) {
        setMode("wander");
      }

      let px = state.x;
      let py = state.y;

      if (state.mode === "wander") {
        const radiusX = Math.min(width * 0.35, 420);
        const radiusY = Math.min(height * 0.22, 230);

        const swirlX = Math.cos(state.t * 0.18) * radiusX + Math.sin(state.t * 0.55) * 30;
        const swirlY = Math.sin(state.t * 0.21) * radiusY + Math.cos(state.t * 0.47) * 26;

        px = centerX + swirlX;
        py = centerY + swirlY;
      } else if (state.mode === "inspect-title") {
        const { x: tx, y: ty } = titleTargetRef.current;
        const baseX = tx || centerX;
        const baseY = (ty || height * 0.18) + 80;

        px = baseX + Math.cos(state.t * 1.1) * 24;
        py = baseY + Math.sin(state.t * 1.3) * 16;
      } else if (state.mode === "slide-edge") {
        const progress = Math.min(state.modeTime / 9, 1);
        const path = margin + progress * (width - margin * 2);
        const pathY = margin + progress * (height - margin * 2);

        switch (state.slideEdge) {
          case "top":
            px = path;
            py = margin + 6 * Math.sin(state.t * 1.2);
            break;
          case "bottom":
            px = path;
            py = height - margin + 6 * Math.cos(state.t * 1.2);
            break;
          case "left":
            px = margin + 6 * Math.sin(state.t * 1.2);
            py = pathY;
            break;
          case "right":
            px = width - margin + 6 * Math.cos(state.t * 1.2);
            py = pathY;
            break;
        }
      }

      px += Math.sin(state.t * 2.2) * 2;
      py += Math.cos(state.t * 2.0) * 2;

      if (mouseRecentlyActive) {
        const dxm = px - mouse.x;
        const dym = py - mouse.y;
        const dist = Math.sqrt(dxm * dxm + dym * dym);
        const repelRadius = 220;

        if (dist > 0 && dist < repelRadius) {
          const nx = dxm / dist;
          const ny = dym / dist;
          const strength = ((repelRadius - dist) / repelRadius) * 100;
          px += nx * strength;
          py += ny * strength;
        }
      }

      px = Math.max(margin, Math.min(width - margin, px));
      py = Math.max(margin, Math.min(height - margin, py));

      const maxSpeed = 200;
      const maxStep = maxSpeed * dt;

      let dx = px - state.x;
      let dy = py - state.y;
      const distToTarget = Math.sqrt(dx * dx + dy * dy);

      if (distToTarget > maxStep && distToTarget > 0) {
        const s = maxStep / distToTarget;
        dx *= s;
        dy *= s;
      }

      state.x += dx;
      state.y += dy;

      state.x = Math.max(margin, Math.min(width - margin, state.x));
      state.y = Math.max(margin, Math.min(height - margin, state.y));

      const speed = distToTarget / dt || 0;
      const scale = 1 + Math.min(speed / 300, 0.08);
      const tiltX = dy * 0.02;
      const tiltY = -dx * 0.02;

      if (orbRef.current) {
        orbRef.current.style.transform = `
          translate3d(${state.x - 24}px, ${state.y - 24}px, 0)
          scale(${scale})
          rotateX(${tiltX}deg)
          rotateY(${tiltY}deg)
        `;
        orbRef.current.style.filter =
          "drop-shadow(0 0 18px rgba(56,189,248,0.55)) drop-shadow(0 0 50px rgba(244,114,182,0.55))";
      }
    };

    frameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  const handleMouseMove = (event: React.MouseEvent<HTMLElement>) => {
    mouseRef.current.x = event.clientX;
    mouseRef.current.y = event.clientY;
    mouseRef.current.active = true;
    mouseRef.current.lastMove = performance.now();
  };

  const handleMouseLeave = () => {
    mouseRef.current.active = false;
  };

  const toolsCount = metrics.toolsCount || 0;
  const avgRating = metrics.avgRating;
  const ratingCount = metrics.ratingCount || 0;
  const ratedTools = metrics.ratedTools || 0;

  // ✅ lightweight “hours saved” proxy (clearly marked as an estimate)
  const estHoursSaved = ratingCount ? Math.max(1, Math.round((ratingCount * 2) / 60)) : 0;

  return (
    <>
      <main
        className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#020617] to-black text-slate-50"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* top scroll progress */}
        <div className="pointer-events-none fixed left-0 top-0 z-[60] h-[2px] w-full bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-fuchsia-400 via-violet-300 to-cyan-200"
            style={{ width: `${Math.round(scrollP * 100)}%` }}
          />
        </div>

        {/* ambient glows */}
        <div className="pointer-events-none absolute -left-40 top-0 h-80 w-80 rounded-full bg-fuchsia-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-cyan-500/25 blur-3xl" />
        <div className="pointer-events-none absolute left-1/2 top-40 h-72 w-[38rem] -translate-x-1/2 rounded-full bg-violet-500/10 blur-3xl" />

        {/* header */}
        <header
          className={`sticky top-0 z-50 mx-auto w-full border-b border-transparent ${
            scrolled ? "border-white/10 bg-slate-950/35 backdrop-blur-xl" : "bg-transparent"
          }`}
        >
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
            {/* ✅ Atlas word a bit larger */}
            <Link href="/" aria-label="Atlas home" className="group inline-flex items-center gap-3">
              <span className="text-2xl font-semibold tracking-tight text-slate-50 transition group-hover:opacity-95 sm:text-3xl">
                Atlas
              </span>
              <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.65rem] font-semibold text-slate-200/90 backdrop-blur-xl">
                <span className="h-2 w-2 rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-300" />
                {toolsCount ? `${formatInt(toolsCount)} tools live` : "Tools live"}
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href="/tools"
                className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-100 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10 sm:inline-flex"
              >
                Browse tools
              </Link>
              <AuthPill />
            </div>
          </div>
        </header>

        {/* orb */}
        <div
          ref={orbRef}
          className="pointer-events-none fixed left-0 top-0 z-30 h-12 w-12 rounded-full bg-gradient-to-tr from-fuchsia-500 via-violet-500 to-cyan-300"
        >
          <div className="absolute inset-1 rounded-full bg-slate-950/60" />
          <div className="animate-orb-pulse absolute inset-0 rounded-full bg-gradient-to-tr from-fuchsia-400/90 via-violet-300/95 to-cyan-200/90 mix-blend-screen" />
          <div className="absolute left-2 top-1.5 h-4 w-4 rounded-full bg-gradient-to-br from-white/90 via-cyan-100/70 to-transparent blur-[1px] opacity-90" />
          <div className="absolute right-1.5 bottom-2 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-cyan-100 via-white/70 to-transparent opacity-80" />
        </div>

        {/* HERO */}
        <section className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-10 sm:pt-12">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-slate-300">
                Experimental • Auto-generated AI micro-apps
              </div>

              <h1
                ref={titleRef}
                className="mt-5 text-balance text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl lg:text-6xl"
              >
                Atlas turns your{" "}
                <span className="bg-gradient-to-r from-fuchsia-400 via-violet-300 to-cyan-200 bg-clip-text text-transparent">
                  real work
                </span>{" "}
                into custom AI tools.
              </h1>


              <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed text-slate-300 sm:text-base">
                Stop rewriting the same emails, rebuilding the same checklists, and reformatting messy notes. Atlas turns
                your raw work into clear outputs in seconds — by using the right tool for the job.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/tools"
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 px-8 py-3 text-sm font-semibold text-slate-950 shadow-xl shadow-fuchsia-500/30 transition hover:translate-y-0.5 hover:shadow-2xl"
                >
                  Explore tools →
                </Link>

                <Link
                  href="#how-it-works"
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-8 py-3 text-sm font-semibold text-slate-100 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10"
                >
                  How it works
                </Link>
              </div>

              <div className="mt-8 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard
                  label="Tools live"
                  value={toolsCount ? formatInt(toolsCount) : "—"}
                  sub="Purpose-built micro tools (and growing)."
                />
                <StatCard
                  label="Hours saved"
                  value={estHoursSaved ? `~${formatInt(estHoursSaved)}h` : "—"}
                  sub={estHoursSaved ? "Est. from ratings × ~2 min saved/use." : "Sign in + use tools to start tracking."}
                />
                <StatCard label="Time to value" value="~15s" sub="Pick a tool → paste text → get output." />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 text-[0.7rem] text-slate-400">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-cyan-300/90" />
                  Zero setup
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-fuchsia-300/90" />
                  New tools added continuously
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400/90" />
                  Save tools when signed in
                </span>
              </div>
            </div>

            {/* ✅ Right hero: brighter 3 cards */}
            <div className="relative">
              <ProcessCard toolsCount={toolsCount} avgRating={avgRating} ratingCount={ratingCount} />
            </div>
          </div>

          <div className="mt-10">
            <ToolCarousel compact />
          </div>
        </section>

        {/* sections */}
        <section ref={(el) => reveal(el)} className="reveal relative z-10 mx-auto w-full max-w-6xl px-4 pt-16">
          <SectionHeading
            eyebrow="Why Atlas"
            metricPill={toolsCount ? `${formatInt(toolsCount)} tools live` : undefined}
            title="The quickest way to get a tool that matches the job"
            desc="Most AI experiences are a blank chat box. Atlas is a library of tightly-scoped micro-apps — each one designed to produce a specific, reliable output with minimal effort."
          />

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <FeatureCard
              kicker="Focused UX"
              title="Designed around the task"
              desc="Each tool has the right inputs, output format, and guardrails — so you aren’t prompting from scratch every time."
            />
            <FeatureCard
              kicker="Discovery"
              title="Find better ways to work"
              desc="Browse by title, search, or categories. Atlas helps you stumble into optimizations you didn’t know existed."
            />
            <FeatureCard
              kicker="Feedback loop"
              title="Gets sharper over time"
              desc="Ratings + saves reveal what works. The best tools influence how future tools are generated and tuned."
            />
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section
          id="how-it-works"
          ref={(el) => reveal(el)}
          className="reveal relative z-10 mx-auto w-full max-w-6xl px-4 pt-16"
        >
          <SectionHeading
            eyebrow="How it works"
            metricPill={ratingCount ? `${formatInt(ratingCount)} ratings fed back` : undefined}
            title="Atlas recommends, then generates what’s missing"
            desc="Upload or describe your work → get recommendations → save what sticks → Atlas builds the next tools from the patterns."
          />

          <div className="mt-8 grid w-full gap-6 md:grid-cols-3">
            <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_0_40px_rgba(15,23,42,0.9)] backdrop-blur-xl transition hover:-translate-y-[1px] hover:border-fuchsia-400/70 hover:shadow-[0_0_60px_rgba(236,72,153,0.7)]">
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-fuchsia-500/20 text-fuchsia-300">
                  <UploadCloud className="h-4 w-4" />
                </span>
                <div className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-300">01</div>
              </div>
              <h3 className="mb-1 text-sm font-semibold text-slate-50">Share your workflow</h3>
              <p className="text-xs leading-relaxed text-slate-300">
                Upload docs or describe your role. Atlas identifies repeatable tasks and friction points.
              </p>
            </div>

            <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_0_40px_rgba(15,23,42,0.9)] backdrop-blur-xl transition hover:-translate-y-[1px] hover:border-violet-400/70 hover:shadow-[0_0_60px_rgba(129,140,248,0.7)]">
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-300">02</div>
              </div>
              <h3 className="mb-1 text-sm font-semibold text-slate-50">Get recommendations</h3>
              <p className="text-xs leading-relaxed text-slate-300">
                Atlas suggests the best tools for your exact context — plus adjacent tools you’ll likely benefit from.
              </p>
            </div>

            <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_0_40px_rgba(15,23,42,0.9)] backdrop-blur-xl transition hover:-translate-y-[1px] hover:border-cyan-400/70 hover:shadow-[0_0_60px_rgba(34,211,238,0.7)]">
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-200">
                  <Wand2 className="h-4 w-4" />
                </span>
                <div className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-300">03</div>
              </div>
              <h3 className="mb-1 text-sm font-semibold text-slate-50">Tools are built constantly</h3>
              <p className="text-xs leading-relaxed text-slate-300">
                Saves + ratings signal what’s valuable. Those signals shape the next tools Atlas generates.
              </p>
            </div>
          </div>

          <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-100">Want the fastest path?</div>
                <div className="mt-1 text-sm text-slate-300">
                  Browse the library and save the tools that match your workflows.
                </div>
              </div>
              <Link
                href="/tools"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 px-7 py-3 text-sm font-semibold text-slate-950 shadow-xl shadow-fuchsia-500/30 transition hover:translate-y-0.5 hover:shadow-2xl"
              >
                Browse tools →
              </Link>
            </div>
          </div>
        </section>

        {/* USE CASES */}
        <section ref={(el) => reveal(el)} className="reveal relative z-10 mx-auto w-full max-w-6xl px-4 pt-16">
          <SectionHeading
            eyebrow="Use cases"
            metricPill={toolsCount ? `${formatInt(toolsCount)} ways to work faster` : undefined}
            title="Built for the messy parts of work"
            desc="Atlas shines when you need something tight, specific, and fast — not a long conversation."
          />

          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              kicker="Writing"
              title="Emails, replies, rewrites"
              desc="Turn rough drafts into crisp, professional responses with the right tone and structure."
            />
            <FeatureCard
              kicker="Ops"
              title="Checklists, SOPs, validation"
              desc="Convert procedures and requirements into actionable checklists and audits."
            />
            <FeatureCard
              kicker="Planning"
              title="Events, meetings, run-of-show"
              desc="Generate step-by-step plans that remove the ‘what am I forgetting?’ anxiety."
            />
            <FeatureCard
              kicker="Support"
              title="Customer responses"
              desc="Create empathetic, clear replies that reduce back-and-forth and improve satisfaction."
            />
            <FeatureCard
              kicker="Decision"
              title="Summaries + next steps"
              desc="Extract the key points, risks, and actions from messy notes, threads, or drafts."
            />
            <FeatureCard
              kicker="Growth"
              title="Marketing + positioning"
              desc="Test hooks, value props, and landing copy — quickly — with tools that stay on-task."
            />
          </div>
        </section>

        {/* FAQ */}
        <section ref={(el) => reveal(el)} className="reveal relative z-10 mx-auto w-full max-w-6xl px-4 pt-16">
          <SectionHeading
            eyebrow="FAQ"
            metricPill={avgRating ? `Avg ${avgRating.toFixed(1)} rating` : undefined}
            title="Quick answers"
            desc="If you’re new, this is the fastest mental model of what Atlas is (and isn’t)."
          />

          <div className="mt-8 grid gap-3 md:grid-cols-2">
            <FAQItem
              q="Is Atlas a chatbot?"
              a="No — it’s a library of micro-apps. Each tool is designed for a specific job with the right inputs and a predictable output."
            />
            <FAQItem
              q="Do I need to sign in?"
              a="You can browse tools without signing in. Sign in to save tools and build your personal tool stack."
            />
            <FAQItem
              q="How are tools created?"
              a="Atlas generates tools from observed patterns and performance signals. The best tools influence how future ones are built."
            />
            <FAQItem
              q="What’s the core value?"
              a="Speed + focus. Instead of prompting from scratch, you pick a purpose-built tool and get a high-quality result fast."
            />
          </div>
        </section>

        {/* FINAL CTA */}
        <section ref={(el) => reveal(el)} className="reveal relative z-10 mx-auto w-full max-w-6xl px-4 pb-20 pt-16">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-7 shadow-[0_0_80px_rgba(15,23,42,0.9)] backdrop-blur-xl">
            <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />

            <div className="relative">
              <h3 className="text-balance text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
                Start with the library. Save what works. Build your stack.
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
                The fastest way to understand Atlas is to try a few tools. You’ll immediately feel the difference
                between “prompting” and “using a purpose-built micro-app.”
              </p>

              <div className="mt-5 flex flex-wrap gap-2 text-[0.7rem] text-slate-400">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400/90" />
                  Save tools
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-cyan-300/90" />
                  Rate tools
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-fuchsia-300/90" />
                  Improve the loop
                </span>
                {toolsCount ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-cyan-100">
                    {formatInt(toolsCount)} tools live
                  </span>
                ) : null}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/tools"
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 px-8 py-3 text-sm font-semibold text-slate-950 shadow-xl shadow-fuchsia-500/30 transition hover:translate-y-0.5 hover:shadow-2xl"
                >
                  Explore tools →
                </Link>
                <button
                  onClick={() => signIn("google", { callbackUrl: "/tools" })}
                  className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-8 py-3 text-sm font-semibold text-slate-100 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10"
                >
                  Sign in to save tools
                </button>
              </div>
            </div>
          </div>

          <footer className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-center text-xs text-slate-400 sm:flex-row sm:text-left">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-300" />
              <span>Atlas • experimental</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/tools" className="hover:text-slate-200">
                Tools
              </Link>
              <Link href="#how-it-works" className="hover:text-slate-200">
                How it works
              </Link>
            </div>
          </footer>
        </section>
      </main>

      {/* global styles (marquee + orb pulse + reveals) */}
      <style jsx global>{`
        @keyframes orb-pulse {
          0% {
            transform: scale(0.9);
            opacity: 0.85;
          }
          50% {
            transform: scale(1.05);
            opacity: 1;
          }
          100% {
            transform: scale(0.9);
            opacity: 0.85;
          }
        }
        .animate-orb-pulse {
          animation: orb-pulse 2.7s ease-in-out infinite;
        }

        /* ===== subtle section reveal ===== */
        .reveal {
          opacity: 0;
          transform: translateY(14px);
          transition: opacity 700ms ease, transform 700ms ease;
          will-change: opacity, transform;
        }
        .reveal.reveal-in {
          opacity: 1;
          transform: translateY(0);
        }

        /* ===== Atlas tool marquee ===== */
        .atlasMarquee {
          overflow: hidden;
          width: 100%;
        }

        .atlasMarqueeTrack {
          --gap: 16px;
          --cardw: clamp(260px, 28vw, 360px);

          display: flex;
          align-items: stretch;
          gap: var(--gap);
          width: max-content;
          will-change: transform;
          animation: atlas-marquee-left 185s linear infinite;
        }

        .atlasToolCard {
          flex: 0 0 var(--cardw);
        }

        .atlasMarquee:hover .atlasMarqueeTrack {
          animation-play-state: paused;
        }

        @keyframes atlas-marquee-left {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .atlasMarqueeTrack {
            animation: none !important;
          }
          .animate-orb-pulse {
            animation: none !important;
          }
          .reveal {
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </>
  );
}
