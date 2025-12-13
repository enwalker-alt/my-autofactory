"use client";

import { useState } from "react";

type ToolClientProps = {
  slug: string;
  inputLabel: string;
  outputLabel: string;
  features?: string[];
};

export default function ToolClient({
  slug,
  inputLabel,
  outputLabel,
  features = [],
}: ToolClientProps) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function runTool() {
    setErrorMsg(null);
    setLoading(true);
    setOutput("");

    try {
      const res = await fetch(`/api/tools/${slug}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ input }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed (${res.status})`);
      }

      const data = (await res.json()) as { output?: string };
      setOutput(data.output ?? "");
    } catch (e: any) {
      setErrorMsg(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(output || "");
    } catch {
      // ignore
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Features (optional) */}
      {features.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {features.map((f) => (
            <span
              key={f}
              className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/5 text-slate-200"
            >
              {f}
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* INPUT */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="text-xs font-semibold text-slate-200 mb-2">
            {inputLabel}
          </div>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={12}
            className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-purple-400/40"
            placeholder="Paste or type here…"
          />

          <button
            type="button"
            onClick={runTool}
            disabled={loading || !input.trim()}
            className={[
              "mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold transition",
              "border border-purple-400/30 bg-purple-500/15 text-purple-100 hover:bg-purple-500/20",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            ].join(" ")}
          >
            {loading ? "Running…" : "Run"}
          </button>

          {errorMsg && (
            <div className="mt-3 text-xs text-red-300">{errorMsg}</div>
          )}
        </div>

        {/* OUTPUT */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-xs font-semibold text-slate-200">
              {outputLabel}
            </div>

            <button
              type="button"
              onClick={copyOutput}
              disabled={!output}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-100 hover:bg-white/10 disabled:opacity-50"
            >
              Copy
            </button>
          </div>

          <div className="min-h-[280px] rounded-xl border border-white/10 bg-white text-black px-3 py-3 text-sm leading-relaxed whitespace-pre-wrap">
            {output || <span className="text-slate-500">Output will appear here…</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
