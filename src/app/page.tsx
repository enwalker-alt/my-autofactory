"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

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
            <span className="relative text-[0.7rem] font-bold tracking-tight">
              A
            </span>
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

            <span className="hidden max-w-[160px] truncate text-slate-100/90 sm:block">
              {name}
            </span>

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
                <div className="text-sm font-semibold text-slate-100">
                  {name}
                </div>
                {email ? (
                  <div className="mt-0.5 truncate text-xs text-slate-300">
                    {email}
                  </div>
                ) : (
                  <div className="mt-0.5 text-xs text-slate-400">
                    Connected via Google
                  </div>
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

                <div className="mt-3 text-[0.65rem] text-slate-400">
                  Atlas identity layer • v0
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stars({
  value,
  count,
}: {
  value?: number | null;
  count?: number | null;
}) {
  const v = typeof value === "number" ? value : null;
  const c = typeof count === "number" ? count : null;

  if (v == null) {
    return (
      <div className="text-[0.7rem] text-slate-400">
        New tool • be the first to rate
      </div>
    );
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

function ToolCardMini({ tool }: { tool: ToolMeta }) {
  return (
    <div className="atlasToolCard group rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_40px_rgba(15,23,42,0.9)] backdrop-blur-xl transition hover:border-cyan-300/30 hover:bg-white/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-50">
            {tool.title}
          </div>
          <div className="mt-1">
            <Stars value={tool.avgRating} count={tool.ratingCount} />
          </div>
        </div>

        <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.65rem] font-semibold text-slate-200/90">
          Tool
        </div>
      </div>

      <p className="mt-2 line-clamp-3 text-xs text-slate-300">
        {tool.description}
      </p>

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

/**
 * ✅ What you asked for:
 * - ONE horizontal carousel (not vertical)
 * - shows ~3 across
 * - auto-scrolls right → left
 * - repeats forever
 */
function ToolCarousel() {
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
    // duplicate for seamless loop
    return [...tools, ...tools];
  }, [tools]);

  return (
    <section className="mt-16 w-full max-w-6xl">
      <div className="mx-auto mb-4 flex w-full items-end justify-between gap-4 px-1">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Inside the library
          </h3>
          <p className="mt-1 text-xs text-slate-300">
            A live stream of Atlas micro-tools — endlessly scrolling.
          </p>
        </div>
        <Link
          href="/tools"
          className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-100 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10 sm:inline-flex"
        >
          Browse all →
        </Link>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-[0_0_60px_rgba(15,23,42,1)] backdrop-blur-xl">
        {/* Edge fade */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-black/90 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-black/90 to-transparent" />

        <div className="px-5 py-6">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl border border-white/10 bg-white/5 p-4"
                >
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
                <Link
                  href="/tools"
                  className="text-xs font-semibold text-cyan-200/90 hover:text-cyan-200"
                >
                  Go to Tools →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 px-1 text-[0.7rem] text-slate-400">
        Tip: hover the carousel to pause.
      </p>
    </section>
  );
}

export default function HomePage() {
  const orbRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);

  const viewportRef = useRef({ width: 1280, height: 720 });
  const titleTargetRef = useRef({ x: 0, y: 0 });

  const mouseRef = useRef<{
    x: number;
    y: number;
    active: boolean;
    lastMove: number;
  }>({
    x: 0,
    y: 0,
    active: false,
    lastMove: 0,
  });

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
      y: height * 0.6,
      t: 0,
      mode: "wander",
      modeTime: 0,
      slideEdge: "bottom",
    };

    const chooseEdge = () => {
      const edges: Array<"top" | "bottom" | "left" | "right"> = [
        "top",
        "bottom",
        "left",
        "right",
      ];
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
      const centerY = height * 0.6;

      const mouse = mouseRef.current;
      const mouseRecentlyActive =
        mouse.active && now - mouse.lastMove < 2000 && mouse.x !== 0;

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
        const radiusY = Math.min(height * 0.25, 260);

        const swirlX =
          Math.cos(state.t * 0.18) * radiusX +
          Math.sin(state.t * 0.55) * 30;
        const swirlY =
          Math.sin(state.t * 0.21) * radiusY +
          Math.cos(state.t * 0.47) * 26;

        px = centerX + swirlX;
        py = centerY + swirlY;
      } else if (state.mode === "inspect-title") {
        const { x: tx, y: ty } = titleTargetRef.current;
        const baseX = tx || centerX;
        const baseY = (ty || height * 0.2) + 80;

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

  return (
    <>
      <main
        className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050816] via-[#020617] to-black text-slate-50"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="pointer-events-none absolute -left-40 top-0 h-80 w-80 rounded-full bg-fuchsia-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-cyan-500/25 blur-3xl" />

        <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-4 pt-5">
          <div />
          <div className="flex items-center gap-2">
            <AuthPill />
          </div>
        </header>

        <div
          ref={orbRef}
          className="pointer-events-none fixed left-0 top-0 z-30 h-12 w-12 rounded-full bg-gradient-to-tr from-fuchsia-500 via-violet-500 to-cyan-300"
        >
          <div className="absolute inset-1 rounded-full bg-slate-950/60" />
          <div className="animate-orb-pulse absolute inset-0 rounded-full bg-gradient-to-tr from-fuchsia-400/90 via-violet-300/95 to-cyan-200/90 mix-blend-screen" />
          <div className="absolute left-2 top-1.5 h-4 w-4 rounded-full bg-gradient-to-br from-white/90 via-cyan-100/70 to-transparent blur-[1px] opacity-90" />
          <div className="absolute right-1.5 bottom-2 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-cyan-100 via-white/70 to-transparent opacity-80" />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center px-4 py-16">
          <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-300">
              Experimental • Auto-generated AI micro-apps
            </span>

            <h1
              ref={titleRef}
              className="text-balance text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl"
            >
              Atlas
            </h1>
          </div>

          <div className="mt-10 grid w-full max-w-5xl gap-6 md:grid-cols-3">
            <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_0_40px_rgba(15,23,42,0.9)] backdrop-blur-xl transition hover:border-fuchsia-400/70 hover:shadow-[0_0_60px_rgba(236,72,153,0.7)]">
              <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-fuchsia-500/20 text-xs font-semibold text-fuchsia-300">
                01
              </div>
              <h2 className="mb-1 text-sm font-semibold text-slate-50">
                Problem Discovery
              </h2>
              <p className="text-xs text-slate-300">
                Every few hours, Atlas scans patterns in how people work, write,
                research, and make decisions — identifying repeated frustrations
                where a small, focused tool could save time or reduce confusion.
              </p>
            </div>

            <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_0_40px_rgba(15,23,42,0.9)] backdrop-blur-xl transition hover:border-violet-400/70 hover:shadow-[0_0_60px_rgba(129,140,248,0.7)]">
              <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/20 text-xs font-semibold text-violet-300">
                02
              </div>
              <h2 className="mb-1 text-sm font-semibold text-slate-50">
                Tool Creation
              </h2>
              <p className="text-xs text-slate-300">
                Once a problem is identified, Atlas creates a purpose-built AI
                tool: chooses the right inputs, designs a simple interface, and
                crafts a specialized prompt for the task.
              </p>
            </div>

            <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_0_40px_rgba(15,23,42,0.9)] backdrop-blur-xl transition hover:border-cyan-400/70 hover:shadow-[0_0_60px_rgba(34,211,238,0.7)]">
              <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/20 text-xs font-semibold text-cyan-200">
                03
              </div>
              <h2 className="mb-1 text-sm font-semibold text-slate-50">
                Continuous Improvement
              </h2>
              <p className="text-xs text-slate-300">
                After release, Atlas learns what works by watching which tools
                people use, save, and rate highly. The best performers shape how
                future tools are built — including how prompts are written,
                structured, and tuned — so every release gets sharper and more
                reliable over time.
              </p>
            </div>
          </div>

          <div className="mt-14 flex flex-col items-center justify-center">
            <Link
              href="/tools"
              className="rounded-full bg-gradient-to-r from-fuchsia-500 via-violet-500 to-cyan-400 px-12 py-3.5 text-base font-semibold text-slate-950 shadow-xl shadow-fuchsia-500/30 transition hover:translate-y-0.5 hover:shadow-2xl"
            >
              View All Tools
            </Link>
          </div>

          {/* ✅ The correct horizontal auto-scrolling carousel */}
          <ToolCarousel />
        </div>
      </main>

      {/* ✅ GLOBAL so it applies inside child components */}
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

        /* ===== Atlas tool marquee (single-row carousel) ===== */
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

        /* Each card occupies the computed width so you see ~3 across */
        .atlasToolCard {
          flex: 0 0 var(--cardw);
        }

        /* Pause on hover */
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
        }
      `}</style>
    </>
  );
}
