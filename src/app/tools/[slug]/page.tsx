import fs from "fs";
import path from "path";
import Link from "next/link";
import ToolClient from "./ToolClient";

type ToolConfig = {
  slug: string;
  title: string;
  description: string;
  inputLabel: string;
  outputLabel: string;
  systemPrompt: string;
  temperature?: number;
};

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

  return (
    <main className="min-h-screen bg-[#020617] text-slate-100">
      <div className="relative mx-auto max-w-5xl px-4 pt-20 pb-16 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-72 bg-gradient-to-b from-purple-700/30 via-transparent to-transparent blur-3xl" />

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

        <header className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-2">
            {config.title}
          </h1>
          <p className="max-w-2xl text-sm sm:text-base text-slate-300 leading-relaxed">
            {config.description}
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 backdrop-blur shadow-xl shadow-purple-500/25 p-4 sm:p-6 lg:p-8">
          <div className="mb-4 flex justify-end">
            <div className="flex flex-col items-end text-[11px] text-slate-400">
              <span className="uppercase tracking-wide text-slate-500">
                Mode
              </span>
              <span className="font-mono text-xs text-slate-200">{slug}</span>
            </div>
          </div>

          <ToolClient
            slug={config.slug}
            inputLabel={config.inputLabel}
            outputLabel={config.outputLabel}
          />

          <div className="mt-6 border-t border-white/5 pt-4 text-[11px] sm:text-xs text-slate-500 flex justify-end">
            <Link
              href="/tools"
              className="inline-flex items-center rounded-full border border-white/10 px-3 py-1 hover:border-white/30 hover:text-slate-200 transition"
            >
              ← Back to Tool Library
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
