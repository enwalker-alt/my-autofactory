import fs from "fs";
import path from "path";
import Link from "next/link";
import ToolClient from "./ToolClient";
import AuthPill from "@/components/AuthPill";

const SaveButton = ({
  slug,
  initialSaved,
  isSignedIn,
}: {
  slug: string;
  initialSaved: boolean;
  isSignedIn: boolean;
}) => {
  // simple non-interactive fallback to avoid missing-module errors;
  // replace with the real interactive client component when available
  return (
    <button
      className={[
        "inline-flex items-center gap-2 rounded-full border px-4 py-2",
        "text-sm sm:text-base font-medium",
        "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/25",
        "shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20",
        "transition",
      ].join(" ")}
      aria-pressed={initialSaved}
      title={
        isSignedIn
          ? initialSaved
            ? "Saved"
            : "Save tool"
          : "Sign in to save"
      }
    >
      <span className="text-base leading-none">{initialSaved ? "★" : "☆"}</span>
      <span>{initialSaved ? "Saved" : "Save"}</span>
    </button>
  );
};

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ToolConfig = {
  slug: string;
  title: string;
  description: string;
  inputLabel: string;
  outputLabel: string;
  systemPrompt: string;
  temperature?: number;
  features?: string[];
};

export const dynamic = "force-dynamic";

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const configPath = path.join(process.cwd(), "tool-configs", `${slug}.json`);

  if (!fs.existsSync(configPath)) {
    return (
      <main className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center">
        <div className="max-w-md w-full px-6 py-8 rounded-3xl border border-white/10 bg-slate-900/70 backdrop-blur shadow-xl shadow-purple-500/20 text-center">
          <p className="text-lg font-semibold mb-2">Tool not found</p>
          <p className="text-sm text-slate-400 mb-6">
            We couldn&apos;t find a tool at this URL.
          </p>
          <Link
            href="/tools"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-blue-500 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition"
          >
            ← Back to Tool Library
          </Link>
        </div>
      </main>
    );
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  const config: ToolConfig = JSON.parse(raw);

  // ✅ server-side session + initial saved state
  const session = await auth();
  const userId = (session as any)?.user?.id;
  const isSignedIn = !!userId;

  let initialSaved = false;

  if (userId) {
    const toolRow = await prisma.tool.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (toolRow) {
      const existing = await prisma.savedTool.findUnique({
        where: { userId_toolId: { userId, toolId: toolRow.id } },
        select: { id: true },
      });
      initialSaved = !!existing;
    }
  }

  return (
    <main className="min-h-screen bg-[#020617] text-slate-100">
      <div className="relative mx-auto max-w-5xl px-4 pt-20 pb-16 sm:px-6 lg:px-8">
        {/* LOGIN PILL — top right */}
        <div className="absolute right-4 top-6 z-20">
          <AuthPill />
        </div>

        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-72 bg-gradient-to-b from-purple-700/30 via-transparent to-transparent blur-3xl" />

        {/* Breadcrumb + status */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <Link href="/" className="hover:text-slate-200 transition-colors">
              Atlas
            </Link>
            <span className="text-slate-600">/</span>
            <Link
              href="/tools"
              className="hover:text-slate-200 transition-colors"
            >
              Tool Library
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-slate-300 line-clamp-1">{config.title}</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] text-emerald-400/90">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="uppercase tracking-wide">Tool Online</span>
          </div>
        </div>

        {/* Title + Save button (top-right above Mode) */}
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-2">
              {config.title}
            </h1>
            <p className="max-w-2xl text-sm sm:text-base text-slate-300 leading-relaxed">
              {config.description}
            </p>
          </div>

          {/* Save button moved here */}
          <div className="shrink-0 pt-1">
            <SaveButton
              slug={slug}
              initialSaved={initialSaved}
              isSignedIn={isSignedIn}
            />
          </div>
        </header>

        {/* Tool container */}
        <section className="relative rounded-3xl border border-white/10 bg-slate-900/70 backdrop-blur shadow-xl shadow-purple-500/25 p-4 sm:p-6 lg:p-8">
          <div className="mb-4 flex justify-end">
            <div className="flex flex-col items-end text-[11px] text-slate-400">
              <span className="uppercase tracking-wide text-slate-500">Mode</span>
              <span className="font-mono text-xs text-slate-200">{slug}</span>
            </div>
          </div>

          <ToolClient
            slug={config.slug}
            inputLabel={config.inputLabel}
            outputLabel={config.outputLabel}
            features={config.features}
          />

          {/* Bottom row: back only (save removed from bottom) */}
          <div className="mt-6 border-t border-white/5 pt-4 flex items-center justify-between gap-3">
            <Link
              href="/tools"
              className="inline-flex items-center rounded-full border border-white/10 px-3 py-1 text-[11px] sm:text-xs hover:border-white/30 hover:text-slate-200 transition"
            >
              ← Back to Tool Library
            </Link>

            <div className="text-[11px] sm:text-xs text-slate-500">
              {initialSaved ? "Saved to your library" : "Not saved"}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
