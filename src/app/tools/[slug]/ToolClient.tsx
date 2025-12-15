"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

/**
 * Backwards compatible incoming preset shapes:
 * - Old: { label, input }  (used to fill textarea)
 * - New: { label, prompt, hint? } (refinement lens / focus)
 *
 * NEW BEHAVIOR:
 * - We NEVER fill the textarea from presets.
 * - Legacy {input} gets converted into a lens prompt automatically.
 */
type ToolPreset =
  | { label: string; input: string }
  | { label: string; prompt: string; hint?: string };

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
  focusLabel?: string;
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

function safeStr(x: any) {
  return typeof x === "string" ? x : "";
}

function safeJsonParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function safeJsonPretty(s: string) {
  const parsed = safeJsonParse(s);
  if (!parsed) return s;
  return JSON.stringify(parsed, null, 2);
}

function isSimpleDisplayObject(x: any) {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const keys = Object.keys(x);
  if (keys.length === 0 || keys.length > 14) return false;

  for (const k of keys) {
    const v = (x as any)[k];
    if (
      v === null ||
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean"
    ) {
      continue;
    }
    if (Array.isArray(v) && v.every((a) => typeof a === "string")) continue;
    return false;
  }
  return true;
}

function titleCaseKey(k: string) {
  return k
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function normalizeToLens(
  p: ToolPreset
): { label: string; prompt: string; hint?: string } {
  const label = safeStr((p as any)?.label).trim() || "Refine";
  // Preferred: prompt lens
  if ("prompt" in p && safeStr((p as any)?.prompt).trim()) {
    return {
      label,
      prompt: safeStr((p as any)?.prompt).trim(),
      hint: safeStr((p as any)?.hint).trim() || undefined,
    };
  }

  // Legacy: convert input into a lens instruction
  const legacy = safeStr((p as any)?.input).trim();
  return {
    label,
    prompt: legacy
      ? `Apply this refinement lens while generating: ${legacy}`
      : "Apply a refinement lens to improve quality and specificity.",
    hint: "Converted from legacy preset",
  };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function ToolClient({
  slug,
  inputLabel,
  outputLabel,
  features,
  presets,
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

  // Media transcription UX
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeNote, setTranscribeNote] = useState<string | null>(null);

  const [output, setOutput] = useState("");

  // ✅ Always start in Plain mode on load
  const [outputFormat, setOutputFormat] = useState<"plain" | "json">("plain");
  const [serverOutputFormat, setServerOutputFormat] = useState<"plain" | "json">("plain");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Focus lens (active preset)
  const [focusLabel, setFocusLabel] = useState<string>("");
  const [focusPrompt, setFocusPrompt] = useState<string>("");

  // History (local)
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ✅ When you navigate between tools, reset to plain
  useEffect(() => {
    setOutputFormat("plain");
    setServerOutputFormat("plain");
  }, [slug]);

  const hasAnyInput = useMemo(() => {
    return input.trim().length > 0 || fileTexts.some((t) => t.trim().length > 0);
  }, [input, fileTexts]);

  const parsedJson = useMemo(() => {
    if (!output) return null;
    if (serverOutputFormat !== "json") return null;
    return safeJsonParse(output);
  }, [output, serverOutputFormat]);

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
    setTranscribeNote(null);
    setTranscribing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const isText = (f: File) =>
    f.type.startsWith("text/") ||
    ["application/json", "text/html", "application/xml", "application/pdf"].includes(f.type);

  const isMedia = (f: File) => f.type.startsWith("audio/") || f.type.startsWith("video/");

  const readFileAsText = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });

  // --------- LARGE MEDIA SUPPORT (Vercel Blob) ----------
  const MAX_MEDIA_MB = 500; // adjust for your product / plan

  async function uploadToBlob(file: File): Promise<string> {
    const { upload } = await import("@vercel/blob/client");

    const safeName = file.name.replace(/\s+/g, "-");
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`;

    const res = await upload(unique, file, {
      access: "public",
      handleUploadUrl: "/api/blob/upload", // or "/api/blob/token"
    });

    return String((res as any)?.url || "");
  }

  async function transcribeMediaFile(file: File): Promise<string> {
    // 0) Client-side size guard
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_MEDIA_MB) {
      throw new Error(`File too large (${sizeMB.toFixed(1)}MB). Max is ${MAX_MEDIA_MB}MB.`);
    }

    // 1) Upload media to Vercel Blob and get public URL
    setTranscribeNote(`Uploading ${file.name}…`);
    const audioUrl = await uploadToBlob(file);
    if (!audioUrl) throw new Error("Upload failed (no URL returned)");

    // 2) Start transcription job (returns an id)
    setTranscribeNote(`Transcribing ${file.name}…`);

    const res = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ blobUrl: audioUrl, mimeType: file.type }),
    });

    const data = (await res.json().catch(() => ({} as any))) as any;
    if (!res.ok) {
      throw new Error(data?.error || "Transcription failed");
    }

    const id = String(data?.id || "");
    if (!id) throw new Error("Transcription failed (no transcript id returned)");

    // 3) Poll status until completed
    const maxAttempts = 90; // 90 * 2s = 3 minutes
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await sleep(2000);

      const sres = await fetch(`/api/transcribe/status?id=${encodeURIComponent(id)}`, {
        method: "GET",
        cache: "no-store",
      });

      const sdata = (await sres.json().catch(() => ({} as any))) as any;
      if (!sres.ok) {
        throw new Error(sdata?.error || "Failed to check transcription status");
      }

      const status = String(sdata?.status || "");
      if (status === "completed") {
        const text = String(sdata?.text || "");
        return text;
      }

      if (status === "error") {
        throw new Error(String(sdata?.error || "AssemblyAI transcription error"));
      }

      // UI progress
      setTranscribeNote(`Transcribing ${file.name}… (${status || "processing"})`);
    }

    throw new Error("Transcription timed out. Please try again.");
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);

    if (!files.length) {
      clearFiles();
      return;
    }

    const invalid = files.filter((f) => !isText(f) && !isMedia(f));
    if (invalid.length > 0) {
      setError("Unsupported file type. Upload text, audio, video, or PDF files only.");
      clearFiles();
      return;
    }

    setError(null);
    setTranscribeNote(null);

    try {
      const texts: string[] = [];
      const names: string[] = files.map((f) => f.name);

      const mediaFiles = files.filter(isMedia);
      if (mediaFiles.length > 0) {
        setTranscribing(true);
        setTranscribeNote(
          mediaFiles.length === 1
            ? `Preparing ${mediaFiles[0].name}…`
            : `Preparing ${mediaFiles.length} media files…`
        );
      }

      // Process sequentially (safer for rate limits + large uploads)
      for (const f of files) {
        if (isText(f)) {
          const t = await readFileAsText(f);
          texts.push(t);
        } else if (isMedia(f)) {
          const t = await transcribeMediaFile(f);
          const labeled = t.trim() ? `--- Transcription: ${f.name} ---\n\n${t.trim()}` : "";
          texts.push(labeled);
        }
      }

      setFileTexts(texts);
      setFileNames(names);
      setUploadSuccess(true);
      setTranscribeNote(mediaFiles.length > 0 ? "Transcription complete ✓" : "Files ready ✓");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to process one or more files. Please try again.");
      clearFiles();
    } finally {
      setTranscribing(false);
    }
  }

  const fileSummary = useMemo(() => {
    if (!fileNames.length) return "No files selected";
    if (fileNames.length === 1) return fileNames[0];
    return `${fileNames.length} files selected`;
  }, [fileNames]);

  // ----- presets / focus -----
  const lensPresets = useMemo(() => {
    if (!supportsPresets || !Array.isArray(presets)) return [];
    return presets.slice(0, 10).map(normalizeToLens);
  }, [supportsPresets, presets]);

  function applyLens(p: { label: string; prompt: string }) {
    const newLabel = safeStr(p.label).trim();
    const newPrompt = safeStr(p.prompt).trim();

    // toggle off if clicked again
    const nextActive = focusLabel === newLabel ? "" : newLabel;
    setFocusLabel(nextActive);
    setFocusPrompt(nextActive ? newPrompt : "");

    setError(null);
    setClarify(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  // ----- build input -----
  function buildCombinedInput() {
    const filesSection =
      fileTexts.length > 0
        ? fileTexts
            .map((text, idx) =>
              text.trim() ? `--- Uploaded content ${idx + 1} ---\n\n${text.trim()}` : ""
            )
            .filter(Boolean)
            .join("\n\n")
        : "";

    return [input.trim(), filesSection ? `\n\n${filesSection}` : ""].filter(Boolean).join("\n\n");
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
    if (!hasAnyInput || loading || transcribing) return;

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
      const requestedFormat = supportsStructured ? outputFormat : "plain";

      const data = await callToolApi({
        input: combinedInput,
        outputFormat: requestedFormat,
        jsonSchemaHint: supportsStructured ? jsonSchemaHint || "" : "",
        mode: supportsClarify ? "auto" : "simple",

        focusLabel: focusLabel || "",
        focusPrompt: focusPrompt || "",
      });

      const serverFmt = data?.outputFormat === "json" ? ("json" as const) : ("plain" as const);
      setServerOutputFormat(serverFmt);

      if (data?.step === "clarify" && Array.isArray(data?.questions) && data.questions.length > 0) {
        const qs = data.questions
          .map((q: any) => safeStr(q))
          .filter(Boolean)
          .slice(0, 6);

        setClarify({
          questions: qs,
          answers: qs.map(() => ""),
        });
        setOutput("");
        setJustGenerated(false);
        return;
      }

      const out = String(data.output || "");
      setOutput(out);
      setJustGenerated(true);

      pushHistory({
        ts: Date.now(),
        input: combinedInput,
        output: out,
        outputFormat: serverFmt,
        focusLabel: focusLabel || "",
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
    if (!clarify || clarifySubmitting || loading || transcribing) return;

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
      const requestedFormat = supportsStructured ? outputFormat : "plain";

      const data = await callToolApi({
        input: combinedInput,
        answers,
        outputFormat: requestedFormat,
        jsonSchemaHint: supportsStructured ? jsonSchemaHint || "" : "",
        mode: "auto",

        focusLabel: focusLabel || "",
        focusPrompt: focusPrompt || "",
      });

      const serverFmt = data?.outputFormat === "json" ? ("json" as const) : ("plain" as const);
      setServerOutputFormat(serverFmt);

      const out = String(data.output || "");
      setOutput(out);
      setJustGenerated(true);
      setClarify(null);

      pushHistory({
        ts: Date.now(),
        input: combinedInput,
        output: out,
        outputFormat: serverFmt,
        focusLabel: focusLabel || "",
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

  const prettyOutput = useMemo(() => {
    if (!output) return "";
    if (serverOutputFormat === "json") return safeJsonPretty(output);
    return output;
  }, [output, serverOutputFormat]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      {/* PRESETS -> Always refinement lenses */}
      {supportsPresets && lensPresets.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-slate-200">Quick refine (optional)</div>
            <div className="text-[11px] text-slate-500">
              Pick a lens — it improves results without changing your input
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {lensPresets.map((p) => {
              const active = focusLabel === p.label;

              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyLens(p)}
                  className={[
                    "rounded-full border px-3 py-1.5 text-xs transition",
                    active
                      ? "border-white/30 bg-white/10 text-slate-100"
                      : "border-white/10 bg-slate-900/50 text-slate-200 hover:border-white/25 hover:bg-slate-900",
                  ].join(" ")}
                  title={p.hint || "Applies a refinement lens (does not change your input)"}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {focusLabel && (
            <div className="text-[11px] text-slate-400">
              Active refine: <span className="text-slate-200 font-medium">{focusLabel}</span>
              <button
                type="button"
                className="ml-2 text-slate-400 hover:text-slate-200 transition"
                onClick={() => {
                  setFocusLabel("");
                  setFocusPrompt("");
                }}
                title="Clear refine lens"
              >
                (clear)
              </button>
            </div>
          )}
        </div>
      )}

      {/* OUTPUT FORMAT */}
      {supportsStructured && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3">
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-slate-200">Output format</div>
            {outputFormat === "json" ? (
              <div className="text-[11px] text-slate-400">
                JSON mode on{jsonSchemaHint ? ` — ${jsonSchemaHint}` : ""}
              </div>
            ) : (
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
              accept=".txt,.md,.csv,.json,.log,.html,.xml,.pdf,.mp3,.wav,.m4a,.mp4,.mov,.webm"
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

          {(transcribing || transcribeNote) && (
            <div className="flex items-center gap-2 text-xs">
              {transcribing ? (
                <>
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-500 text-[10px] text-black">
                    …
                  </span>
                  <span className="text-slate-300">{transcribeNote || "Working…"}</span>
                </>
              ) : (
                <>
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-black">
                    ✓
                  </span>
                  <span className="text-emerald-400">{transcribeNote}</span>
                </>
              )}
            </div>
          )}

          {uploadSuccess && fileNames.length > 0 && !transcribing && (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-black">
                ✓
              </span>
              <span>
                {fileNames.length} file{fileNames.length > 1 ? "s" : ""} ready
              </span>
            </div>
          )}

          <div className="text-[11px] text-slate-500">
            Supports text/PDF + audio/video (large media uploads supported via Vercel Blob).
          </div>
          <div className="text-[11px] text-slate-600">Media max: {MAX_MEDIA_MB}MB per file.</div>
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
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              if (hasAnyInput && !loading && !clarifySubmitting && !transcribing) {
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
              disabled={clarifySubmitting || loading || transcribing}
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
          disabled={loading || clarifySubmitting || transcribing || !hasAnyInput}
          className={[
            "rounded-md border px-4 py-2 font-medium",
            "border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-100",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          ].join(" ")}
        >
          {transcribing
            ? "Transcribing..."
            : loading
            ? "Generating..."
            : supportsClarify
            ? "Generate (auto)"
            : "Generate"}
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
                      filled={n <= (hoverStars ?? selectedStars ?? 0)}
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
            {serverOutputFormat === "json" && (
              <span className="text-[11px] text-slate-400">Structured view</span>
            )}
          </div>

          {serverOutputFormat === "json" && parsedJson && isSimpleDisplayObject(parsedJson) ? (
            <div className="rounded-xl border border-black/10 bg-white text-black p-4 space-y-4">
              {Object.keys(parsedJson).map((k) => {
                const v = (parsedJson as any)[k];
                return (
                  <div key={k} className="space-y-1">
                    <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-700">
                      {titleCaseKey(k)}
                    </div>

                    {Array.isArray(v) ? (
                      <ul className="list-disc pl-5 space-y-1 text-[14px] leading-relaxed">
                        {v.map((item: string, idx: number) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-[14px] leading-relaxed whitespace-pre-wrap">
                        {String(v)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <pre className="whitespace-pre-wrap border rounded-md p-3 bg-white text-black font-mono text-[13px] leading-relaxed overflow-x-auto">
              {prettyOutput}
            </pre>
          )}
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
                    setServerOutputFormat(h.outputFormat);
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
                    <div className="text-[11px] text-slate-500">
                      {h.outputFormat}
                      {h.focusLabel ? ` • ${h.focusLabel}` : ""}
                    </div>
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
