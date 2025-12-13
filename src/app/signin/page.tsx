"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#050816] via-[#020617] to-black text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_0_60px_rgba(15,23,42,1)] p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-slate-300">
            Continue to Atlas with a single click.
          </p>
        </div>

        <button
          onClick={() => signIn("google", { callbackUrl: "/tools" })}
          className="w-full rounded-2xl bg-white text-slate-950 font-semibold py-3 shadow-lg hover:translate-y-0.5 transition"
        >
          Sign in with Google
        </button>

        <div className="mt-6 flex items-center justify-between text-xs text-slate-400">
          <Link className="hover:text-slate-200" href="/">
            ← Back home
          </Link>
          <span className="opacity-80">Atlas Auth</span>
        </div>
      </div>
    </main>
  );
}
