"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

export default function AuthPill() {
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
      {/* Signed out */}
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
          {/* Signed in */}
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
                    onClick={() => signOut({ callbackUrl: "/" })}
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
