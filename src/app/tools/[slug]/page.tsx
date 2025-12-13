import fs from "fs";
import path from "path";
import Link from "next/link";
import ToolClient from "./ToolClient";
import AuthPill from "@/components/AuthPill";
import SaveButton from "./SaveButton";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ToolPreset =
  | { label: string; input: string }
  | { label: string; prompt: string; hint?: string };

type ToolConfig = {
  slug: string;
  title: string;
  description: string;
  inputLabel: string;
  outputLabel: string;
  systemPrompt: string;
  temperature?: number;

  features?: string[];

  // Optional feature-driven fields
  presets?: ToolPreset[];
  outputFormatDefault?: "plain" | "json";
  jsonSchemaHint?: string;

  clarifyPrompt?: string;
  finalizePrompt?: string;
};

export const dynamic = "force-dynamic";

/* ---------- Rating Stars (display only) ---------- */
function Stars({ avg }: { avg: number }) {
  const rounded = Math.round(avg * 10) / 10;
  const full = Math.floor(rounded);
  const half = rounded - full >= 0.5;

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const isFull = n <= full;
        const isHalf = !isFull && half && n === full + 1;

        return (
          <span
            key={n}
            className={isFull || isHalf ? "text-yellow-300" : "text-slate-600"}
            aria-hidden="true"
          >
            ★
          </span>
        );
      })}
    </div>
  );
}

function safeFeatures(maybe: any): string[] {
  if (!Array.isArray(maybe)) return ["text-input"]; // default baseline
  const cleaned = maybe.map((x) => String(x)).filter(Boolean);
  return cleaned.length ? cleaned : ["text-input"];
}

function normalizePresets(presets: any): ToolPreset[] | undefined {
  if (!Array.isArray(presets)) return undefined;

  const cleaned = presets
    .map((p: any) => {
      const label = typeof p?.label === "string" ? p.label.trim().slice(0, 80) : "";
      if (!label) return null;

      // Lens preset
      if (typeof p?.prompt === "string" && p.prompt.trim()) {
        return {
          label,
          prompt: p.prompt.trim().slice(0, 2000),
          hint: typeof p?.hint === "string" ? p.hint.trim().slice(0, 200) : undefined,
        } as ToolPreset;
      }

      // Legacy preset
      if (typeof p?.input === "string" && p.input.trim()) {
        return {
          label,
          input: p.input.trim().slice(0, 2000),
        } as ToolPreset;
      }

      return null;
    })
    .filter(Boolean) as ToolPreset[];

  return cleaned.length ? cleaned : undefined;
}

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

  // ✅ normalize defaults so old configs don't break
  const normalized: ToolConfig = {
    ...config,
    features: safeFeatures(config.features),

    // ✅ Force plain on load for everyone
    outputFormatDefault: "plain",

    presets: normalizePresets(config.presets),
    jsonSchemaHint: typeof config.jsonSchemaHint === "string" ? config.jsonSchemaHint : undefined,
    clarifyPrompt: typeof config.clarifyPrompt === "string" ? config.clarifyPrompt : undefined,
    finalizePrompt: typeof config.finalizePrompt === "string" ? config.finalizePrompt : undefined,
  };

  /* ---------- Auth ---------- */
  const session = await auth();
  const email = (session as any)?.user?.email as string | undefined;
  const isSignedIn = !!email;

  /* ---------- Ensure tool exists + pull rating aggregates ---------- */
  const toolRow = await prisma.tool.upsert({
    where: { slug },
    update: {
      title: normalized.title,
      description: normalized.description ?? null,
      inputLabel: normalized.inputLabel ?? null,
      outputLabel: normalized.outputLabel ?? null,
    },
    create: {
      slug,
      title: normalized.title,
      description: normalized.description ?? null,
      inputLabel: normalized.inputLabel ?? null,
      outputLabel: normalized.outputLabel ?? null,
    },
    select: {
      id: true,
      ratingAvg: true,
      ratingCount: true,
    },
  });

  /* ---------- Initial saved state ---------- */
  let initialSaved = false;

  if (email) {
    const dbUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (dbUser?.id) {
      const existing = await prisma.savedTool.findUnique({
        where: {
          userId_toolId: {
            userId: dbUser.id,
            toolId: toolRow.id,
          },
        },
        select: { id: true },
      });
      initialSaved = !!existing;
    }
  }

  const ratingAvg = toolRow.ratingAvg ?? 0;
  const ratingCount = toolRow.ratingCount ?? 0;

  return (
    <main className="min-h-screen bg-[#020617] text-slate-100">
      <div className="relative mx-auto max-w-5xl px-4 pt-20 pb-16 sm:px-6 lg:px-8">
        {/* LOGIN PILL */}
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
            <Link href="/tools" className="hover:text-slate-200 transition-colors">
              Tool Library
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-slate-300 line-clamp-1">{normalized.title}</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] text-emerald-400/90">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="uppercase tracking-wide">Tool Online</span>
          </div>
        </div>

        {/* Title + Rating + Save */}
        <header className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-2">
              {normalized.title}
            </h1>

            {/* ⭐ Rating display */}
            <div className="flex items-center gap-3 mb-3">
              <Stars avg={ratingAvg} />
              <div className="text-xs text-slate-300/80">
                <span className="font-semibold text-slate-200">
                  {ratingAvg.toFixed(1)}
                </span>{" "}
                <span className="text-slate-500">({ratingCount} ratings)</span>
              </div>
            </div>

            <p className="max-w-2xl text-sm sm:text-base text-slate-300 leading-relaxed">
              {normalized.description}
            </p>
          </div>

          <div className="shrink-0 pt-1">
            <SaveButton slug={slug} initialSaved={initialSaved} isSignedIn={isSignedIn} />
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
            slug={normalized.slug}
            inputLabel={normalized.inputLabel}
            outputLabel={normalized.outputLabel}
            features={normalized.features}
            presets={normalized.presets}
            outputFormatDefault={normalized.outputFormatDefault}
            jsonSchemaHint={normalized.jsonSchemaHint}
            clarifyPrompt={normalized.clarifyPrompt}
            finalizePrompt={normalized.finalizePrompt}
          />

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
