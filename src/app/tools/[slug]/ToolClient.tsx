"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

type ToolPreset =
  | { label: string; input: string }
  | { label: string; prompt: string; hint?: string };

type AtlasBuildPlan = {
  level?: "micro-tool" | "multi-page-app";
  idea?: any;
  blueprint?: any;
  expanded?: any;
  nextPrompts?: Array<{
    id: string;
    title: string;
    purpose?: string;
    promptTemplate: string;
  }>;
};

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

  // NEW (optional) — produced by generator v2
  atlasBuildPlan?: AtlasBuildPlan;
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

type BuildArtifacts = {
  requirementsJson?: string; // step output
  finalArchJson?: string; // step output
  stubsCode?: string; // step output
  wiringNotes?: string; // step output
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

function ProgressBar({
  value,
  label,
  indeterminate,
}: {
  value?: number | null;
  label?: string;
  indeterminate?: boolean;
}) {
  const pct = typeof value === "number" ? Math.max(0, Math.min(100, value)) : null;

  return (
    <div className="space-y-1">
      {label ? <div className="text-[11px] text-slate-400">{label}</div> : null}
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10 border border-white/10">
        {indeterminate || pct === null ? (
          <div className="h-full w-1/3 animate-[slide_1.1s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-purple-400/80 via-fuchsia-300/80 to-cyan-200/80" />
        ) : (
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-400/80 via-fuchsia-300/80 to-cyan-200/80 transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>

      <style jsx>{`
        @keyframes slide {
          0% {
            transform: translateX(-120%);
          }
          100% {
            transform: translateX(360%);
          }
        }
      `}</style>
    </div>
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

function looksLikeJson(s: string) {
  const t = safeStr(s).trim();
  if (!t) return false;
  return t.startsWith("{") || t.startsWith("[");
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
  if ("prompt" in p && safeStr((p as any)?.prompt).trim()) {
    return {
      label,
      prompt: safeStr((p as any)?.prompt).trim(),
      hint: safeStr((p as any)?.hint).trim() || undefined,
    };
  }

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

function jsonToPlainText(x: any, opts?: { maxDepth?: number; maxLines?: number }) {
  const maxDepth = opts?.maxDepth ?? 6;
  const maxLines = opts?.maxLines ?? 260;

  const lines: string[] = [];
  const push = (line: string) => {
    if (lines.length >= maxLines) return;
    lines.push(line);
  };

  const isPrimitive = (v: any) =>
    v === null || v === undefined || ["string", "number", "boolean"].includes(typeof v);

  const formatPrimitive = (v: any) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    return String(v);
  };

  const walk = (node: any, path: string[], depth: number) => {
    if (lines.length >= maxLines) return;

    if (depth > maxDepth) {
      push(`${"  ".repeat(depth)}• (truncated)`);
      return;
    }

    if (isPrimitive(node)) {
      const key = path[path.length - 1] || "";
      if (key) {
        push(`${"  ".repeat(depth)}${titleCaseKey(key)}: ${formatPrimitive(node)}`.trim());
      } else {
        push(`${"  ".repeat(depth)}${formatPrimitive(node)}`.trim());
      }
      return;
    }

    if (Array.isArray(node)) {
      const key = path[path.length - 1] || "";
      if (key) push(`${"  ".repeat(depth)}${titleCaseKey(key)}:`);

      if (node.every(isPrimitive)) {
        for (const item of node) {
          if (lines.length >= maxLines) break;
          push(`${"  ".repeat(depth + 1)}• ${formatPrimitive(item)}`);
        }
        return;
      }

      node.forEach((item, idx) => {
        if (lines.length >= maxLines) return;
        push(`${"  ".repeat(depth + 1)}- Item ${idx + 1}`);
        walk(item, [], depth + 2);
      });
      return;
    }

    const entries = Object.entries(node as Record<string, any>);
    for (const [k, v] of entries) {
      if (lines.length >= maxLines) break;

      if (isPrimitive(v)) {
        push(`${"  ".repeat(depth)}${titleCaseKey(k)}: ${formatPrimitive(v)}`.trim());
        continue;
      }

      push(`${"  ".repeat(depth)}${titleCaseKey(k)}`);
      push(`${"  ".repeat(depth)}${"-".repeat(Math.min(24, titleCaseKey(k).length))}`);
      walk(v, [k], depth + 1);
      push("");
    }
  };

  walk(x, [], 0);
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  return lines.join("\n");
}

// -------- Upload UX constants --------
const MAX_MEDIA_MB = 500;
const ACCEPT_ATTR =
  ".txt,.md,.csv,.json,.log,.html,.xml,.pdf,.mp3,.wav,.m4a,.mp4,.mov,.webm";

const TYPE_BADGES = [
  { label: "Text", title: ".txt .md .csv .json .log .html .xml" },
  { label: "Audio", title: ".mp3 .wav .m4a" },
  { label: "Video", title: ".mp4 .mov .webm" },
];

// -------- Build mode helpers --------
function fillTemplate(tpl: string, vars: Record<string, string>) {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "g");
    out = out.replace(re, v);
  }
  return out;
}

function pickPrompt(plan?: AtlasBuildPlan, id?: string) {
  const arr = plan?.nextPrompts || [];
  if (id) return arr.find((p) => p.id === id) || null;
  return arr[0] || null;
}

export default function ToolClient({
  slug,
  inputLabel,
  outputLabel,
  features,
  presets,
  jsonSchemaHint,
  atlasBuildPlan,
}: ToolClientProps) {
  const router = useRouter();
  const { data: session } = useSession();

  const supportsFileUpload = features?.includes("file-upload") ?? false;
  const supportsPresets = features?.includes("presets") ?? false;
  const supportsStructured = features?.includes("structured-output") ?? false;
  const supportsClarify = features?.includes("clarify-first") ?? false;
  const supportsHistory = features?.includes("saved-history") ?? false;

  const hasBuildPlan = !!atlasBuildPlan && typeof atlasBuildPlan === "object";
  const [mode, setMode] = useState<"tool" | "build">(hasBuildPlan ? "build" : "tool");

  const [input, setInput] = useState("");
  const [fileTexts, setFileTexts] = useState<string[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Upload/transcription UX
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeNote, setTranscribeNote] = useState<string | null>(null);
  const [uploadStage, setUploadStage] = useState<
    "idle" | "reading" | "uploading" | "transcribing"
  >("idle");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Output
  const [output, setOutput] = useState("");
  const [rawOutput, setRawOutput] = useState<string>("");

  // Always start in Plain mode on load
  const [outputFormat, setOutputFormat] = useState<"plain" | "json">("plain");
  const [serverOutputFormat, setServerOutputFormat] = useState<"plain" | "json">("plain");

  const [formatMismatch, setFormatMismatch] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

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

  // Focus lens (tool mode)
  const [focusLabel, setFocusLabel] = useState<string>("");
  const [focusPrompt, setFocusPrompt] = useState<string>("");

  // History (local)
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Dropzone state
  const [dragOver, setDragOver] = useState(false);

  // Build mode state
  const [buildStepId, setBuildStepId] = useState<string>("planner_refine");
  const [buildNote, setBuildNote] = useState<string>(""); // user-provided constraints/notes
  const [buildArtifacts, setBuildArtifacts] = useState<BuildArtifacts>({});
  const [buildRunning, setBuildRunning] = useState(false);
  const [buildMsg, setBuildMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Reset between tools
  useEffect(() => {
    setOutputFormat("plain");
    setServerOutputFormat("plain");
    setFormatMismatch(false);
    setShowRaw(false);
    setOutput("");
    setRawOutput("");
    setError(null);
    setClarify(null);
    setJustGenerated(false);

    setBuildRunning(false);
    setBuildMsg(null);
    setBuildArtifacts({});
    setBuildNote("");
    setBuildStepId("planner_refine");

    // upload UI reset
    setUploadStage("idle");
    setUploadProgress(null);
    setTranscribeNote(null);
    setTranscribing(false);
    setUploadSuccess(false);
    setFileTexts([]);
    setFileNames([]);

    setMode(hasBuildPlan ? "build" : "tool");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const hasAnyInput = useMemo(() => {
    return input.trim().length > 0 || fileTexts.some((t) => t.trim().length > 0);
  }, [input, fileTexts]);

  const renderText = useMemo(() => {
    return showRaw && rawOutput ? rawOutput : output;
  }, [showRaw, rawOutput, output]);

  const renderFormat = useMemo<"plain" | "json">(() => {
    if (showRaw && rawOutput) {
      return safeJsonParse(rawOutput) ? "json" : "plain";
    }
    return serverOutputFormat;
  }, [showRaw, rawOutput, serverOutputFormat]);

  const parsedJson = useMemo(() => {
    if (!renderText) return null;
    if (renderFormat !== "json") return null;
    return safeJsonParse(renderText);
  }, [renderText, renderFormat]);

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
    setUploadStage("idle");
    setUploadProgress(null);
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
  async function uploadToBlob(file: File): Promise<string> {
    const { upload } = await import("@vercel/blob/client");

    const safeName = file.name.replace(/\s+/g, "-");
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`;

    const res = await upload(unique, file, {
      access: "public",
      handleUploadUrl: "/api/blob/upload",
    });

    return String((res as any)?.url || "");
  }

  async function transcribeMediaFile(file: File): Promise<string> {
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_MEDIA_MB) {
      throw new Error(`File too large (${sizeMB.toFixed(1)}MB). Max is ${MAX_MEDIA_MB}MB.`);
    }

    setUploadStage("uploading");
    setUploadProgress(5);
    setTranscribeNote(`Uploading ${file.name}…`);

    let fake = 5;
    const fakeTimer = window.setInterval(() => {
      fake = Math.min(35, fake + Math.random() * 4);
      setUploadProgress(fake);
    }, 220);

    const audioUrl = await uploadToBlob(file).finally(() => {
      window.clearInterval(fakeTimer);
    });

    if (!audioUrl) throw new Error("Upload failed (no URL returned)");

    setUploadProgress(40);

    setUploadStage("transcribing");
    setTranscribing(true);
    setTranscribeNote(`Transcribing ${file.name}…`);

    const res = await fetch("/api/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ blobUrl: audioUrl, mimeType: file.type }),
    });

    const data = (await res.json().catch(() => ({} as any))) as any;
    if (!res.ok) throw new Error(data?.error || "Transcription failed");

    const id = String(data?.id || "");
    if (!id) throw new Error("Transcription failed (no transcript id returned)");

    const maxAttempts = 90;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await sleep(2000);

      const pct = 40 + Math.round(((attempt + 1) / maxAttempts) * 58);
      setUploadProgress(pct);

      const sres = await fetch(`/api/transcribe/status?id=${encodeURIComponent(id)}`, {
        method: "GET",
        cache: "no-store",
      });

      const sdata = (await sres.json().catch(() => ({} as any))) as any;
      if (!sres.ok) throw new Error(sdata?.error || "Failed to check transcription status");

      const status = String(sdata?.status || "");
      if (status === "completed") {
        setUploadProgress(100);
        return String(sdata?.text || "");
      }
      if (status === "error") throw new Error(String(sdata?.error || "AssemblyAI transcription error"));

      setTranscribeNote(`Transcribing ${file.name}… (${status || "processing"})`);
    }

    throw new Error("Transcription timed out. Please try again.");
  }

  async function handleFiles(files: File[]) {
    if (!files.length) {
      clearFiles();
      return;
    }

    const invalid = files.filter((f) => !isText(f) && !isMedia(f));
    if (invalid.length > 0) {
      setError("Unsupported file type. Upload text, PDF, audio, or video files only.");
      clearFiles();
      return;
    }

    setError(null);
    setTranscribeNote(null);

    try {
      const texts: string[] = [];
      const names: string[] = files.map((f) => f.name);

      setUploadStage("reading");
      setUploadProgress(null);

      const mediaFiles = files.filter(isMedia);
      if (mediaFiles.length > 0) {
        setTranscribing(true);
        setTranscribeNote(
          mediaFiles.length === 1
            ? `Preparing ${mediaFiles[0].name}…`
            : `Preparing ${mediaFiles.length} media files…`
        );
      } else {
        setTranscribing(false);
      }

      for (const f of files) {
        if (isText(f)) {
          setUploadStage("reading");
          setUploadProgress(null);
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
      setUploadStage("idle");
      setUploadProgress(null);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to process one or more files. Please try again.");
      clearFiles();
    } finally {
      setTranscribing(false);
      setDragOver(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    await handleFiles(files);
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

  function applyServerOutput({
    requestedFormat,
    data,
    combinedInput,
  }: {
    requestedFormat: "plain" | "json";
    data: any;
    combinedInput: string;
  }) {
    const serverReportedFmt = data?.outputFormat === "json" ? ("json" as const) : ("plain" as const);
    const outRaw = String(data?.output || "");

    setRawOutput(outRaw);
    setShowRaw(false);

    if (requestedFormat === "plain") {
      const parsed = safeJsonParse(outRaw);
      const didReturnJson = serverReportedFmt === "json" || (looksLikeJson(outRaw) && !!parsed);

      if (didReturnJson && parsed) {
        const converted = jsonToPlainText(parsed);
        setOutput(converted);
        setServerOutputFormat("plain");
        setFormatMismatch(true);
      } else {
        setOutput(outRaw);
        setServerOutputFormat("plain");
        setFormatMismatch(false);
      }

      pushHistory({
        ts: Date.now(),
        input: combinedInput,
        output: didReturnJson && parsed ? jsonToPlainText(parsed) : outRaw,
        outputFormat: "plain",
        focusLabel: focusLabel || "",
      });

      setJustGenerated(true);
      return;
    }

    setFormatMismatch(false);

    const parsed = safeJsonParse(outRaw);
    const effectiveFmt = parsed ? "json" : serverReportedFmt;

    setServerOutputFormat(effectiveFmt);
    setOutput(outRaw);

    pushHistory({
      ts: Date.now(),
      input: combinedInput,
      output: outRaw,
      outputFormat: effectiveFmt,
      focusLabel: focusLabel || "",
    });

    setJustGenerated(true);
  }

  // ----- core submit (tool mode) -----
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasAnyInput || loading || transcribing) return;

    setLoading(true);
    setError(null);
    setOutput("");
    setRawOutput("");
    setFormatMismatch(false);
    setShowRaw(false);

    setJustGenerated(false);
    setHoverStars(null);
    setSelectedStars(null);
    setRatingThanks(false);
    setRatingError(null);

    setClarify(null);

    const combinedInput = buildCombinedInput();

    try {
      const requestedFormat = supportsStructured ? outputFormat : "plain";

      const data = await callToolApi({
        input: combinedInput,
        outputFormat: requestedFormat,
        enforceOutputFormat: true,
        jsonSchemaHint: supportsStructured ? jsonSchemaHint || "" : "",
        mode: supportsClarify ? "auto" : "simple",
        focusLabel: focusLabel || "",
        focusPrompt: focusPrompt || "",
      });

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
        setRawOutput("");
        setJustGenerated(false);
        setFormatMismatch(false);
        setShowRaw(false);
        return;
      }

      applyServerOutput({ requestedFormat, data, combinedInput });
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
    setRawOutput("");
    setJustGenerated(false);
    setFormatMismatch(false);
    setShowRaw(false);

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
        enforceOutputFormat: true,
        jsonSchemaHint: supportsStructured ? jsonSchemaHint || "" : "",
        mode: "auto",
        focusLabel: focusLabel || "",
        focusPrompt: focusPrompt || "",
      });

      applyServerOutput({ requestedFormat, data, combinedInput });
      setClarify(null);
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
    setRawOutput("");
    setFormatMismatch(false);
    setShowRaw(false);
    setJustGenerated(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  async function handleCopy() {
    const toCopy = renderText || "";
    if (!toCopy) return;
    try {
      await navigator.clipboard.writeText(toCopy);
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
    if (!renderText) return "";
    if (renderFormat === "json") return safeJsonPretty(renderText);
    return renderText;
  }, [renderText, renderFormat]);

  // ----- dropzone handlers -----
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files ?? []);
    void handleFiles(dropped);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  // ----- build mode runner -----
  const buildPrompts = useMemo(() => {
    const arr = atlasBuildPlan?.nextPrompts || [];
    return Array.isArray(arr) ? arr.slice(0, 10) : [];
  }, [atlasBuildPlan]);

  const ideaCompact = useMemo(() => {
    const idea = atlasBuildPlan?.idea;
    if (!idea) return "";
    try {
      return JSON.stringify(idea, null, 2);
    } catch {
      return "";
    }
  }, [atlasBuildPlan]);

  const blueprintCompact = useMemo(() => {
    const bp = atlasBuildPlan?.blueprint;
    if (!bp) return "";
    try {
      return JSON.stringify(bp, null, 2);
    } catch {
      return "";
    }
  }, [atlasBuildPlan]);

  const expandedCompact = useMemo(() => {
    const ex = atlasBuildPlan?.expanded;
    if (!ex) return "";
    try {
      return JSON.stringify(ex, null, 2);
    } catch {
      return "";
    }
  }, [atlasBuildPlan]);

  function buildContextBundle() {
    // Keep it short-ish, but include enough for coherence.
    // (You can later move these into server-side plan execution.)
    const ctx = {
      idea: atlasBuildPlan?.idea ?? null,
      blueprint: atlasBuildPlan?.blueprint ?? null,
      expanded: atlasBuildPlan?.expanded ?? null,
      artifacts: buildArtifacts,
      userNotes: buildNote || "",
    };
    return JSON.stringify(ctx, null, 2);
  }

  function inferRequestedFormatForBuild(stepId: string): "plain" | "json" {
    // For build steps, JSON is usually better. But only request JSON if supported.
    if (!supportsStructured) return "plain";
    if (stepId.includes("builder") || stepId.includes("integrator")) return "plain";
    return "json";
  }

  function saveBuildArtifact(stepId: string, out: string, outFmt: "plain" | "json") {
    const trimmed = out || "";
    setBuildArtifacts((prev) => {
      const next: BuildArtifacts = { ...prev };

      if (stepId === "planner_refine") next.requirementsJson = trimmed;
      else if (stepId === "architect_finalize") next.finalArchJson = trimmed;
      else if (stepId === "builder_stubs") next.stubsCode = trimmed;
      else if (stepId === "integrator_wire") next.wiringNotes = trimmed;
      else {
        // best effort: slot based on id keywords
        if (stepId.includes("planner")) next.requirementsJson = trimmed;
        else if (stepId.includes("architect")) next.finalArchJson = trimmed;
        else if (stepId.includes("stub") || stepId.includes("builder")) next.stubsCode = trimmed;
        else if (stepId.includes("integr")) next.wiringNotes = trimmed;
      }

      return next;
    });

    // If server returned JSON and we are in build mode, keep raw as well for copy/export
    if (outFmt === "json") {
      setBuildMsg("Saved structured build output ✓");
    } else {
      setBuildMsg("Saved build output ✓");
    }
    window.setTimeout(() => setBuildMsg(null), 1400);
  }

  async function runBuildStep() {
    if (!hasAnyInput || loading || transcribing || buildRunning) return;

    const step = pickPrompt(atlasBuildPlan, buildStepId) || pickPrompt(atlasBuildPlan);
    if (!step) {
      setError("No build steps found for this tool.");
      return;
    }

    setBuildRunning(true);
    setError(null);
    setOutput("");
    setRawOutput("");
    setFormatMismatch(false);
    setShowRaw(false);
    setJustGenerated(false);
    setClarify(null);

    const combinedInput = buildCombinedInput();
    const ctx = buildContextBundle();

    // Fill template with context + known artifacts
    const prompt = fillTemplate(step.promptTemplate || "", {
      USER_INPUT: combinedInput,
      IDEA: ideaCompact || "",
      BLUEPRINT: blueprintCompact || "",
      EXPANDED: expandedCompact || "",
      CONTEXT: ctx,
      REQUIREMENTS: buildArtifacts.requirementsJson || "",
      FINAL_ARCH: buildArtifacts.finalArchJson || "",
      STUBS: buildArtifacts.stubsCode || "",
    }).trim();

    // We route this through the SAME tool API, using focusPrompt as the “instruction payload”.
    // This makes it work immediately without server changes.
    const requestedFormat = inferRequestedFormatForBuild(step.id);

    try {
      const data = await callToolApi({
        input: combinedInput,
        outputFormat: supportsStructured ? requestedFormat : "plain",
        enforceOutputFormat: true,
        jsonSchemaHint: supportsStructured ? jsonSchemaHint || "" : "",
        mode: supportsClarify ? "auto" : "simple",
        focusLabel: `Build: ${step.title}`,
        focusPrompt: [
          "You are operating in ATLAS BUILD MODE.",
          "You are not a chat assistant. You are producing build artifacts.",
          "Return ONLY what the prompt requests. Avoid filler.",
          "",
          prompt,
        ].join("\n"),
      });

      // Clarify-first still supported, but for build steps we mostly want direct output
      if (data?.step === "clarify" && Array.isArray(data?.questions) && data.questions.length > 0) {
        const qs = data.questions
          .map((q: any) => safeStr(q))
          .filter(Boolean)
          .slice(0, 6);

        setClarify({
          questions: qs,
          answers: qs.map(() => ""),
        });

        setBuildMsg("Answer questions to continue the build step.");
        window.setTimeout(() => setBuildMsg(null), 1600);
        return;
      }

      const outRaw = String(data?.output || "");
      const outFmt = data?.outputFormat === "json" ? "json" : "plain";

      // Display it in the output area (so it feels unified)
      setRawOutput(outRaw);
      setShowRaw(false);
      setOutput(outRaw);
      setServerOutputFormat(outFmt);

      // Save into build artifacts bucket
      saveBuildArtifact(step.id, outRaw, outFmt);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Build step failed");
    } finally {
      setBuildRunning(false);
    }
  }

  async function copyBuildBundle() {
    const bundle = {
      slug,
      atlasBuildPlan: atlasBuildPlan || null,
      artifacts: buildArtifacts,
      userInput: buildCombinedInput(),
      userNotes: buildNote || "",
      exportedAt: new Date().toISOString(),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
      setBuildMsg("Copied full build bundle ✓");
      window.setTimeout(() => setBuildMsg(null), 1200);
    } catch {
      setError("Failed to copy build bundle.");
    }
  }

  return (
    <div className="space-y-5 mt-4">
      {/* MODE TOGGLE (only if plan exists) */}
      {hasBuildPlan && (
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-slate-200">Mode</div>

          <div className="inline-flex rounded-full border border-white/10 bg-slate-950/30 p-1">
            <button
              type="button"
              onClick={() => setMode("build")}
              className={[
                "rounded-full px-3 py-1 text-[11px] font-medium transition",
                mode === "build" ? "bg-white/10 text-white" : "text-slate-300 hover:text-white",
              ].join(" ")}
            >
              Build
            </button>
            <button
              type="button"
              onClick={() => setMode("tool")}
              className={[
                "rounded-full px-3 py-1 text-[11px] font-medium transition",
                mode === "tool" ? "bg-white/10 text-white" : "text-slate-300 hover:text-white",
              ].join(" ")}
            >
              Tool
            </button>
          </div>
        </div>
      )}

      {/* INPUT is shared across modes */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* REFINE LENSES (tool mode primarily, but still useful) */}
        {supportsPresets && lensPresets.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <div className="text-sm font-semibold text-slate-100">Refine lens</div>
              </div>

              {focusLabel ? (
                <div className="text-[11px] text-slate-400">
                  Active: <span className="text-slate-100 font-medium">{focusLabel}</span>
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
              ) : (
                <div className="text-[11px] text-slate-500">Optional</div>
              )}
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
                      "rounded-full border px-3.5 py-2 text-xs font-medium transition",
                      active
                        ? "border-white/30 bg-white/10 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
                        : "border-white/10 bg-slate-900/40 text-slate-200 hover:border-white/25 hover:bg-slate-900/70",
                    ].join(" ")}
                    title={p.hint || "Applies a refinement lens (does not change your input)"}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* OUTPUT FORMAT (compact) */}
        {supportsStructured && mode === "tool" && (
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-slate-200">Output</div>

            <div className="inline-flex rounded-full border border-white/10 bg-slate-950/30 p-1">
              <button
                type="button"
                onClick={() => setOutputFormat("plain")}
                className={[
                  "rounded-full px-3 py-1 text-[11px] font-medium transition",
                  outputFormat === "plain" ? "bg-white/10 text-white" : "text-slate-300 hover:text-white",
                ].join(" ")}
              >
                Plain
              </button>
              <button
                type="button"
                onClick={() => setOutputFormat("json")}
                className={[
                  "rounded-full px-3 py-1 text-[11px] font-medium transition",
                  outputFormat === "json" ? "bg-white/10 text-white" : "text-slate-300 hover:text-white",
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
            <div className="flex items-end justify-between gap-3">
              <label className="block text-sm font-medium text-slate-200">Upload files (optional)</label>
              <div className="text-[11px] text-slate-500">Max media: {MAX_MEDIA_MB}MB each</div>
            </div>

            <input
              ref={fileInputRef}
              id={`file-${slug}`}
              type="file"
              multiple
              accept={ACCEPT_ATTR}
              onChange={handleFileChange}
              className="sr-only"
            />

            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              className={[
                "rounded-2xl border p-4 transition",
                dragOver ? "border-white/30 bg-white/5" : "border-white/10 bg-slate-950/20 hover:border-white/20",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-sm text-slate-200 font-medium">Drag & drop files here</div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {TYPE_BADGES.map((b) => (
                      <span
                        key={b.label}
                        title={`Accepted: ${b.title}`}
                        className="inline-flex items-center rounded-full border border-white/10 bg-slate-900/40 px-3 py-1 text-[11px] text-slate-200 hover:border-white/20 transition"
                      >
                        {b.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {fileNames.length > 0 && (
                    <button
                      type="button"
                      onClick={clearFiles}
                      className="rounded-full border border-white/10 bg-slate-900/40 px-3 py-1.5 text-[11px] text-slate-200 hover:border-white/20 hover:bg-slate-900/70 transition"
                      title="Clear uploaded files"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3">
                <label
                  htmlFor={`file-${slug}`}
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/35 transition cursor-pointer"
                >
                  Choose files
                </label>

                <div className="text-xs text-slate-400 truncate text-right">
                  <span className="text-slate-500">Selected:</span> {fileSummary}
                </div>
              </div>

              {(uploadStage !== "idle" || transcribeNote) && (
                <div className="mt-3">
                  <ProgressBar
                    value={uploadProgress}
                    indeterminate={uploadStage === "uploading" || uploadStage === "reading"}
                    label={
                      transcribeNote ||
                      (uploadStage === "reading"
                        ? "Reading files…"
                        : uploadStage === "uploading"
                        ? "Uploading large file…"
                        : uploadStage === "transcribing"
                        ? "Transcribing…"
                        : "")
                    }
                  />
                </div>
              )}

              {uploadSuccess && fileNames.length > 0 && !transcribing && (
                <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-black">
                    ✓
                  </span>
                  <span>
                    {fileNames.length} file{fileNames.length > 1 ? "s" : ""} ready
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* INPUT */}
        <div className="space-y-2">
          <div className="flex items-end justify-between gap-3">
            <label className="block text-sm font-medium text-slate-200">{inputLabel}</label>
            <div className="text-[11px] text-slate-500">
              Tip: <span className="text-slate-300">Ctrl</span>+<span className="text-slate-300">Enter</span>
            </div>
          </div>

          <textarea
            ref={textareaRef}
            className="w-full rounded-2xl border border-white/10 bg-slate-950/20 p-3 min-h-[170px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400/30"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                if (hasAnyInput && !loading && !clarifySubmitting && !transcribing && mode === "tool") {
                  (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
                }
              }
            }}
            placeholder="Paste or type your text here..."
          />
        </div>

        {/* BUILD MODE PANEL */}
        {mode === "build" && hasBuildPlan && (
          <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-100">Atlas Build</div>
                <div className="text-[11px] text-slate-400">
                  Top-down planning → architecture → stubs → wiring (using the same tool API today).
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">
                  Plan: <span className="text-slate-200">{atlasBuildPlan?.level || "micro-tool"}</span>
                </span>
                <button
                  type="button"
                  onClick={copyBuildBundle}
                  className="rounded-full border border-white/10 bg-slate-900/40 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:border-white/20 hover:bg-slate-900/70 transition"
                  title="Copy plan + artifacts as JSON"
                >
                  Copy bundle
                </button>
              </div>
            </div>

            {/* Step picker */}
            <div className="flex flex-col gap-2">
              <div className="text-[11px] text-slate-500">Build step</div>

              <div className="flex flex-wrap gap-2">
                {(buildPrompts.length ? buildPrompts : []).map((p) => {
                  const active = buildStepId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setBuildStepId(p.id)}
                      className={[
                        "rounded-full border px-3 py-2 text-[11px] font-medium transition",
                        active
                          ? "border-white/30 bg-white/10 text-white"
                          : "border-white/10 bg-slate-900/40 text-slate-200 hover:border-white/25 hover:bg-slate-900/70",
                      ].join(" ")}
                      title={p.purpose || ""}
                    >
                      {p.title}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-900/20 p-3">
                <div className="text-xs font-semibold text-slate-200">Notes / constraints (optional)</div>
                <div className="text-[11px] text-slate-500 mb-2">
                  Add hard constraints like data sources, auth needs, exports, roles, etc.
                </div>
                <textarea
                  value={buildNote}
                  onChange={(e) => setBuildNote(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/30 p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400/30 min-h-[90px]"
                  placeholder="Example: Must support Google login, saved projects, export to PDF, and a dashboard of past runs."
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] text-slate-500">
                  {buildMsg ? <span className="text-emerald-400">{buildMsg}</span> : " "}
                </div>
                <button
                  type="button"
                  onClick={runBuildStep}
                  disabled={!hasAnyInput || transcribing || buildRunning}
                  className={[
                    "rounded-full px-4 py-2 text-xs font-semibold text-white transition",
                    "bg-gradient-to-r from-purple-500 to-blue-500 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/35",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                  ].join(" ")}
                >
                  {buildRunning ? "Running…" : "Run step"}
                </button>
              </div>

              {/* Quick artifact status */}
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-900/20 p-3">
                  <div className="text-xs font-semibold text-slate-200">Requirements</div>
                  <div className="text-[11px] text-slate-500">
                    {buildArtifacts.requirementsJson ? "Captured ✓" : "Not yet"}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/20 p-3">
                  <div className="text-xs font-semibold text-slate-200">Final architecture</div>
                  <div className="text-[11px] text-slate-500">
                    {buildArtifacts.finalArchJson ? "Captured ✓" : "Not yet"}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/20 p-3">
                  <div className="text-xs font-semibold text-slate-200">Page stubs</div>
                  <div className="text-[11px] text-slate-500">
                    {buildArtifacts.stubsCode ? "Captured ✓" : "Not yet"}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/20 p-3">
                  <div className="text-xs font-semibold text-slate-200">Wiring notes</div>
                  <div className="text-[11px] text-slate-500">
                    {buildArtifacts.wiringNotes ? "Captured ✓" : "Not yet"}
                  </div>
                </div>
              </div>

              {/* Plan peek */}
              <details className="rounded-2xl border border-white/10 bg-slate-900/10 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-slate-200">
                  View Atlas plan (idea / blueprint / expanded)
                </summary>
                <div className="mt-3 space-y-3">
                  {ideaCompact && (
                    <div>
                      <div className="text-[11px] text-slate-400 mb-1">Idea</div>
                      <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-white text-black p-3 font-mono text-[12px] leading-relaxed overflow-x-auto">
                        {ideaCompact}
                      </pre>
                    </div>
                  )}
                  {blueprintCompact && (
                    <div>
                      <div className="text-[11px] text-slate-400 mb-1">Blueprint</div>
                      <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-white text-black p-3 font-mono text-[12px] leading-relaxed overflow-x-auto">
                        {blueprintCompact}
                      </pre>
                    </div>
                  )}
                  {expandedCompact && (
                    <div>
                      <div className="text-[11px] text-slate-400 mb-1">Expanded specs</div>
                      <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-white text-black p-3 font-mono text-[12px] leading-relaxed overflow-x-auto">
                        {expandedCompact}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            </div>
          </div>
        )}

        {/* CLARIFY UI (shared) */}
        {clarify && (
          <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-100">Quick questions</div>
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
                    className="w-full rounded-xl border border-white/10 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400/30"
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
                disabled={clarifySubmitting || loading || transcribing || buildRunning}
                className={[
                  "rounded-full px-4 py-2 text-xs font-semibold text-white transition",
                  "bg-gradient-to-r from-purple-500 to-blue-500 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/35",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                ].join(" ")}
              >
                {clarifySubmitting ? "Generating..." : "Generate with answers"}
              </button>
            </div>
          </div>
        )}

        {/* ACTIONS (tool mode submit button) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {mode === "tool" ? (
            <button
              type="submit"
              disabled={loading || clarifySubmitting || transcribing || !hasAnyInput}
              className={[
                "rounded-full px-5 py-2.5 text-sm font-semibold text-white transition",
                "bg-gradient-to-r from-purple-500 to-blue-500 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/35",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              ].join(" ")}
            >
              {transcribing ? "Working…" : loading ? "Generating…" : supportsClarify ? "Generate (auto)" : "Generate"}
            </button>
          ) : (
            <div className="text-[11px] text-slate-500">
              Build mode uses <span className="text-slate-300">Run step</span> above.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4">
            {renderText && justGenerated && mode === "tool" && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-300 hidden sm:inline">Rate:</span>

                <div className="flex items-center gap-1" onMouseLeave={() => setHoverStars(null)}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} onMouseEnter={() => setHoverStars(n)} className="inline-flex">
                      <Star
                        sizeClass="text-2xl"
                        filled={n <= (hoverStars ?? selectedStars ?? 0)}
                        disabled={ratingSubmitting}
                        title={session?.user ? `Rate ${n} star${n > 1 ? "s" : ""}` : "Sign in to rate"}
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

            {renderText && (
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-full border border-white/10 bg-slate-900/40 px-4 py-2 text-xs font-semibold text-slate-100 hover:border-white/20 hover:bg-slate-900/70 transition"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            )}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* OUTPUT */}
        {renderText && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-100">{outputLabel}</h3>

              <div className="flex items-center gap-2">
                {formatMismatch && (
                  <span className="text-[11px] text-amber-300">Returned JSON → converted to plain text</span>
                )}

                {rawOutput && looksLikeJson(rawOutput) && (
                  <button
                    type="button"
                    onClick={() => setShowRaw((v) => !v)}
                    className="text-[11px] text-slate-400 hover:text-slate-200 transition"
                    title="Toggle raw output view"
                  >
                    {showRaw ? "Hide raw" : "View raw"}
                  </button>
                )}

                {renderFormat === "json" && <span className="text-[11px] text-slate-400">Structured</span>}
              </div>
            </div>

            {renderFormat === "json" && parsedJson && isSimpleDisplayObject(parsedJson) ? (
              <div className="rounded-2xl border border-white/10 bg-white text-black p-4 space-y-4">
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
                        <div className="text-[14px] leading-relaxed whitespace-pre-wrap">{String(v)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <pre className="whitespace-pre-wrap rounded-2xl border border-white/10 bg-white text-black p-3 font-mono text-[13px] leading-relaxed overflow-x-auto">
                {prettyOutput}
              </pre>
            )}
          </div>
        )}

        {/* HISTORY */}
        {supportsHistory && mode === "tool" && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/30 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-100">Recent runs</div>
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
                      setRawOutput("");
                      setOutputFormat(h.outputFormat);
                      setServerOutputFormat(h.outputFormat);
                      setFormatMismatch(false);
                      setShowRaw(false);
                      setClarify(null);
                      setJustGenerated(false);
                      setError(null);
                      setTimeout(() => textareaRef.current?.focus(), 50);
                    }}
                    className="w-full text-left rounded-2xl border border-white/10 bg-slate-900/30 p-3 hover:border-white/20 transition"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-slate-200 truncate">{new Date(h.ts).toLocaleString()}</div>
                      <div className="text-[11px] text-slate-500">
                        {h.outputFormat}
                        {h.focusLabel ? ` • ${h.focusLabel}` : ""}
                      </div>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400 line-clamp-2">{h.input.slice(0, 180)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
