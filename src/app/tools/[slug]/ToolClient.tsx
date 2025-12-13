"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

type ToolPreset = { label: string; input: string };

type ToolClientProps = {
  slug: string;
  inputLabel: string;
  outputLabel: string;
  features?: string[];

  presets?: ToolPreset[];
  outputFormatDefault?: "plain" | "json";
  jsonSchemaHint?: string;

  clarifyPrompt?: string;
  finalizePrompt?: string;
};

type HistoryItem = {
  ts: number;
  input: string;
  output: string;
  outputFormat: "plain" | "json";
};

type ClarifyState = {
  questions: string[];
  answers: string[];
};

function Star({
  filled,
  onClick,
  disabled,
  title,
  sizeClass = "text-xl",
}: {
  filled: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  sizeClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        sizeClass,
        "leading-none",
        disabled ? "opacity-60 cursor-not-allowed" : "hover:scale-[1.08]",
        "transition",
        "select-none",
      ].join(" ")}
      aria-label={filled ? "Filled star" : "Empty star"}
    >
      <span className={filled ? "text-yellow-400" : "text-slate-500"}>★</span>
    </button>
  );
}

function safeJsonPretty(s: string) {
  try {
    const obj = JSON.parse(s);
    return JSON.stringify(obj, null, 2);
  } catch {
    return s;
  }
}

function safeStr(x: any) {
  return typeof x === "string" ? x : "";
}

export default function ToolClient({
  slug,
  inputLabel,
  outputLabel,
  features,
  presets,
  outputFormatDefault = "plain",
  jsonSchemaHint,
}: ToolClientProps) {
  const router = useRouter();
  const { data: session } = useSession();

  const supportsFileUpload = features?.includes("file-upload") ?? false;
  const supportsPresets = features?.includes("presets") ?? false;
  const supportsStructured = features?.includes("structured-output") ?? false;
  const supportsClarify = features?.includes("clarify-first") ?? false;
  const supportsHistory = features?.includes("saved-history") ?? false;

  const [input, setInput] = useState("");
  const [fileTexts, setFileTexts] = useState<string[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [outputFormat, setOutputFormat] = useState<"plain" | "json">(outputFormatDefault);

  // Clarify-first UI state
  const [clarify, setClarify] = useState<ClarifyState | null>(null);
  const [clarifySubmitting, setClarifySubmitting] = useState(false);

  // Rating UI state
  const [justGenerated, setJustGenerated] = useState(false);
  const [hoverStars, setHoverStars] = useState<number | null>(null);
  const [selectedStars, setSelectedStars] = useState<number | null>(null);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingThanks, setRatingThanks] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

  // QoL
  const [copied, setCopied] = useState(false);

  // History (local)
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const hasAnyInput = useMemo(() => {
    return input.trim().length > 0 || fileTexts.some((t) => t.trim().length > 0);
  }, [input, fileTexts]);

  // ----- History storage -----
  const historyKey = `atlas_history_${slug}`;

  useEffect(() => {
    if (!supportsHistory) return;
    try {
      const raw = localStorage.getItem(historyKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setHistory(parsed.slice(0, 10));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, supportsHistory]);

  function pushHistory(item: HistoryItem) {
    if (!supportsHistory) return;
    const next = [item, ...history].slice(0, 10);
    setHistory(next);
    try {
      localStorage.setItem(historyKey, JSON.stringify(next));
    } catch {}
  }

  function clearHistory() {
    if (!supportsHistory) return;
    setHistory([]);
    try {
      localStorage.removeItem(historyKey);
    } catch {}
  }

  // ----- file handling -----
  function clearFiles() {
    setFileTexts([]);
    setFileNames([]);
    setUploadSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);

    if (!files.length) {
      clearFiles();
      return;
    }

    const nonText = files.filter(
      (f) =>
        !f.type.startsWith("text/") &&
        !["application/json", "text/html", "application/xml"].includes(f.type)
    );

    if (nonText.length > 0) {
      setError(
        "Right now this tool only supports text-based files (e.g. .txt, .md, .csv). Please convert your PDF or Word document to text first."
      );
      clearFiles();
      return;
    }

    try {
      const readFileAsText = (file: File) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsText(file);
        });

      const texts = await Promise.all(files.map(readFileAsText));

      setFileTexts(texts);
      setFileNames(files.map((f) => f.name));
      setUploadSuccess(true);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to read one or more files. Please try again.");
      clearFiles();
    }
  }

  const fileSummary = useMemo(() => {
    if (!fileNames.length) return "No files selected";
    if (fileNames.length === 1) return fileNames[0];
    return `${fileNames.length} files selected`;
  }, [fileNames]);

  // ----- presets -----
  function applyPreset(p: ToolPreset) {
    setInput(p.input || "");
    setError(null);
    // Reset clarify state when user changes direction
    setClarify(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  // ----- build input -----
  function buildCombinedInput() {
    const filesSection =
      fileTexts.length > 0
        ? fileTexts
            .map((text, idx) =>
              text.trim()
                ? `--- Uploaded document ${idx + 1} ---\n\n${text.trim()}`
                : ""
            )
            .filter(Boolean)
            .join("\n\n")
        : "";

    return [input.trim(), filesSection ? `\n\n${filesSection}` : ""]
      .filter(Boolean)
      .join("\n\n");
  }

  // ----- API call helper -----
  async function callToolApi(payload: any) {
    const res = await fetch(`/api/tools/${slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "Request failed");
    }

    return (await res.json().catch(() => ({}))) as any;
  }

  // ----- core submit -----
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasAnyInput || loading) return;

    setLoading(true);
    setError(null);
    setOutput("");

    // Reset rating each generation
    setJustGenerated(false);
    setHoverStars(null);
    setSelectedStars(null);
    setRatingThanks(false);
    setRatingError(null);

    // Reset clarify flow when starting fresh
    setClarify(null);

    const combinedInput = buildCombinedInput();

    try {
      const data = await callToolApi({
        input: combinedInput,
        outputFormat: supportsStructured ? outputFormat : "plain",
        jsonSchemaHint: supportsStructured ? jsonSchemaHint || "" : "",
        mode: supportsClarify ? "auto" : "simple",
      });

      // New route may return clarify step
      if (data?.step === "clarify" && Array.isArray(data?.questions) && data.questions.length > 0) {
        const qs = data.questions.map((q: any) => safeStr(q)).filter(Boolean).slice(0, 6);
        setClarify({
          questions: qs,
          answers: qs.map(() => ""),
        });
        setOutput("");
        setJustGenerated(false);
        return;
      }

      // Otherwise final output
      const out = String(data.output || "");
      setOutput(out);
      setJustGenerated(true);

      pushHistory({
        ts: Date.now(),
        input: combinedInput,
        output: out,
        outputFormat: supportsStructured ? outputFormat : "plain",
      });
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Something went wrong");
      setJustGenerated(false);
    } finally {
      setLoading(false);
    }
  }

  // ----- clarify submit -----
  async function submitClarifyAnswers() {
    if (!clarify || clarifySubmitting || loading) return;

    const answers = clarify.answers.map((a) => safeStr(a).trim());
    const answeredCount = answers.filter(Boolean).length;

    if (answeredCount === 0) {
      setError("Please answer at least one question (or click Back and revise your input).");
      return;
    }

    setClarifySubmitting(true);
    setError(null);
    setOutput("");
    setJustGenerated(false);

    // Reset rating
    setHoverStars(null);
    setSelectedStars(null);
    setRatingThanks(false);
    setRatingError(null);

    const combinedInput = buildCombinedInput();

    try {
      const data = await callToolApi({
        input: combinedInput,
        answers,
        outputFormat: supportsStructured ? outputFormat : "plain",
        jsonSchemaHint: supportsStructured ? jsonSchemaHint || "" : "",
        mode: "auto",
      });

      const out = String(data.output || "");
      setOutput(out);
      setJustGenerated(true);
      setClarify(null);

      pushHistory({
        ts: Date.now(),
        input: combinedInput,
        output: out,
        outputFormat: supportsStructured ? outputFormat : "plain",
      });
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Something went wrong");
      setJustGenerated(false);
    } finally {
      setClarifySubmitting(false);
    }
  }

  function cancelClarify() {
    setClarify(null);
    setError(null);
    setOutput("");
    setJustGenerated(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  async function handleCopy() {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 900);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  // ----- rating -----
  async function submitRating(value: number) {
    if (!session?.user) {
      await signIn("google", { callbackUrl: `/tools/${slug}` });
      return;
    }
    if (ratingSubmitting) return;

    setSelectedStars(value);
    setRatingSubmitting(true);
    setRatingThanks(false);
    setRatingError(null);

    try {
      const res = await fetch(`/api/tools/${slug}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        credentials: "include",
        body: JSON.stringify({ value }),
      });

      if (res.status === 401) {
        await signIn("google", { callbackUrl: `/tools/${slug}` });
        return;
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Failed to submit rating");
      }

      router.refresh();

      setRatingThanks(true);
      window.setTimeout(() => setRatingThanks(false), 1600);
    } catch (e: any) {
      console.error(e);
      setRatingError("Rating failed. Try again.");
      setRatingThanks(false);
    } finally {
      setRatingSubmitting(false);
    }
  }

  const displayStars = hoverStars ?? selectedStars ?? 0;

  const prettyOutput = useMemo(() => {
    if (!output) return "";
    if (supportsStructured && outputFormat === "json") return safeJsonPretty(output);
    return output;
  }, [output, outputFormat, supportsStructured]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      {/* PRESETS */}
      {supportsPresets && Array.isArray(presets) && presets.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-slate-200">Quick start</div>
            <div className="text-[11px] text-slate-500">Click a preset to fill the input</div>
          </div>

          <div className="flex flex-wrap gap-2">
            {presets.slice(0, 6).map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="rounded-full border border-white/10 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-200 hover:border-white/25 hover:bg-slate-900 transition"
                title="Apply preset"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* OUTPUT FORMAT */}
      {supportsStructured && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3">
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-slate-200">Output format</div>
            {outputFormat === "json" && (
              <div className="text-[11px] text-slate-400">
                JSON mode on{jsonSchemaHint ? ` — ${jsonSchemaHint}` : ""}
              </div>
            )}
            {outputFormat === "plain" && (
              <div className="text-[11px] text-slate-400">Plain text mode</div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOutputFormat("plain")}
              className={[
                "rounded-full px-3 py-1.5 text-xs border transition",
                outputFormat === "plain"
                  ? "border-white/30 bg-white/10 text-slate-100"
                  : "border-white/10 bg-slate-900/40 text-slate-300 hover:border-white/20",
              ].join(" ")}
            >
              Plain
            </button>
            <button
              type="button"
              onClick={() => setOutputFormat("json")}
              className={[
                "rounded-full px-3 py-1.5 text-xs border transition",
                outputFormat === "json"
                  ? "border-white/30 bg-white/10 text-slate-100"
                  : "border-white/10 bg-slate-900/40 text-slate-300 hover:border-white/20",
              ].join(" ")}
            >
              JSON
            </button>
          </div>
        </div>
      )}

      {/* FILE UPLOAD */}
      {supportsFileUpload && (
        <div className="space-y-2">
          <label className="block font-medium">Upload document (optional)</label>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              id={`file-${slug}`}
              type="file"
              multiple
              accept=".txt,.md,.csv,.json,.log,.html,.xml"
              onChange={handleFileChange}
              className="sr-only"
            />

            <label
              htmlFor={`file-${slug}`}
              className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium
                         border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-100 cursor-pointer"
            >
              Choose files
            </label>

            <span className="text-xs text-slate-400 truncate max-w-[280px] sm:max-w-[420px]">
              {fileSummary}
            </span>

            {fileNames.length > 0 && (
              <button
                type="button"
                onClick={clearFiles}
                className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium
                           border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200"
                title="Clear uploaded files"
              >
                Clear
              </button>
            )}
          </div>

          {uploadSuccess && fileNames.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-black">
                ✓
              </span>
              <span>
                {fileNames.length} file{fileNames.length > 1 ? "s" : ""} ready
              </span>
            </div>
          )}

          {fileNames.length > 0 && (
            <ul className="text-[11px] text-slate-400 space-y-0.5">
              {fileNames.slice(0, 6).map((name) => (
                <li key={name} className="truncate">
                  {name}
                </li>
              ))}
              {fileNames.length > 6 && (
                <li className="text-slate-500">+ {fileNames.length - 6} more</li>
              )}
            </ul>
          )}
        </div>
      )}

      {/* INPUT */}
      <div>
        <label className="block font-medium mb-1">{inputLabel}</label>
        <textarea
          ref={textareaRef}
          className="w-full border rounded-md p-2 min-h-[160px] bg-slate-900/60 text-slate-100 placeholder:text-slate-500"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (error) setError(null);
            // If user edits input while in clarify mode, keep clarify but don’t auto-reset;
            // they can hit "Back" or re-generate.
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              if (hasAnyInput && !loading && !clarifySubmitting) {
                (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
              }
            }
          }}
          placeholder="Paste or type your text here..."
        />
        <p className="mt-1 text-[11px] text-slate-500">
          Tip: Press <span className="text-slate-300">Ctrl</span>+
          <span className="text-slate-300">Enter</span> to generate.
        </p>
      </div>

      {/* CLARIFY UI */}
      {clarify && (
        <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-slate-200">Quick questions</div>
              <div className="text-[11px] text-slate-400">
                Answer what you can — Atlas will generate a better result.
              </div>
            </div>

            <button
              type="button"
              onClick={cancelClarify}
              className="text-[11px] text-slate-400 hover:text-slate-200 transition"
            >
              ← Back
            </button>
          </div>

          <div className="space-y-3">
            {clarify.questions.map((q, idx) => (
              <div key={`${idx}-${q}`} className="space-y-1">
                <div className="text-xs font-medium text-slate-200">
                  {idx + 1}. {q}
                </div>
                <input
                  value={clarify.answers[idx] || ""}
                  onChange={(e) => {
                    const next = [...clarify.answers];
                    next[idx] = e.target.value;
                    setClarify({ ...clarify, answers: next });
                    if (error) setError(null);
                  }}
                  className="w-full rounded-md border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                  placeholder="Type your answer (optional)"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="text-[11px] text-slate-500">
              Tip: You can leave some blank — we’ll proceed with partial answers.
            </div>

            <button
              type="button"
              onClick={submitClarifyAnswers}
              disabled={clarifySubmitting || loading}
              className={[
                "rounded-md border px-4 py-2 font-medium",
                "border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-100",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              ].join(" ")}
            >
              {clarifySubmitting ? "Generating..." : "Generate with answers"}
            </button>
          </div>
        </div>
      )}

      {/* ACTIONS */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="submit"
          disabled={loading || clarifySubmitting || !hasAnyInput}
          className={[
            "rounded-md border px-4 py-2 font-medium",
            "border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-100",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          ].join(" ")}
        >
          {loading ? "Generating..." : supportsClarify ? "Generate (auto)" : "Generate"}
        </button>

        <div className="flex items-center gap-4">
          {output && justGenerated && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-300 hidden sm:inline">Rate output:</span>

              <div className="flex items-center gap-1" onMouseLeave={() => setHoverStars(null)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} onMouseEnter={() => setHoverStars(n)} className="inline-flex">
                    <Star
                      sizeClass="text-2xl"
                      filled={n <= displayStars}
                      disabled={ratingSubmitting}
                      title={
                        session?.user
                          ? `Rate ${n} star${n > 1 ? "s" : ""}`
                          : "Sign in to rate"
                      }
                      onClick={() => submitRating(n)}
                    />
                  </span>
                ))}
              </div>

              {ratingSubmitting && <span className="text-xs text-slate-400">Saving...</span>}
              {ratingThanks && <span className="text-xs text-emerald-400">Thanks!</span>}
              {ratingError && <span className="text-xs text-red-400">{ratingError}</span>}
            </div>
          )}

          {output && (
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-md border px-4 py-2 font-medium
                         border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-100"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* OUTPUT */}
      {output && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">{outputLabel}</h3>
            {supportsStructured && outputFormat === "json" && (
              <span className="text-[11px] text-slate-400">JSON pretty-printed</span>
            )}
          </div>

          <div className="whitespace-pre-wrap border rounded-md p-3 bg-white text-black">
            {prettyOutput}
          </div>
        </div>
      )}

      {/* HISTORY */}
      {supportsHistory && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/30 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-slate-200">Recent runs</div>
            <button
              type="button"
              onClick={clearHistory}
              className="text-[11px] text-slate-400 hover:text-slate-200 transition"
            >
              Clear history
            </button>
          </div>

          {history.length === 0 ? (
            <div className="text-[11px] text-slate-500">No history yet.</div>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 6).map((h) => (
                <button
                  key={h.ts}
                  type="button"
                  onClick={() => {
                    setInput(h.input);
                    setOutput(h.output);
                    setOutputFormat(h.outputFormat);
                    setClarify(null);
                    setJustGenerated(false);
                    setError(null);
                    setTimeout(() => textareaRef.current?.focus(), 50);
                  }}
                  className="w-full text-left rounded-xl border border-white/10 bg-slate-900/40 p-3 hover:border-white/20 transition"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-200 truncate">
                      {new Date(h.ts).toLocaleString()}
                    </div>
                    <div className="text-[11px] text-slate-500">{h.outputFormat}</div>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400 line-clamp-2">
                    {h.input.slice(0, 180)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </form>
  );
}
