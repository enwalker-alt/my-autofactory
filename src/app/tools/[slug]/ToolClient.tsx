"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

type ToolClientProps = {
  slug: string;
  inputLabel: string;
  outputLabel: string;
  features?: string[];
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

export default function ToolClient({
  slug,
  inputLabel,
  outputLabel,
  features,
}: ToolClientProps) {
  const router = useRouter();
  const { data: session } = useSession();

  const [input, setInput] = useState("");
  const [fileTexts, setFileTexts] = useState<string[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rating UI state
  const [justGenerated, setJustGenerated] = useState(false);
  const [hoverStars, setHoverStars] = useState<number | null>(null);
  const [selectedStars, setSelectedStars] = useState<number | null>(null);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingThanks, setRatingThanks] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

  // QoL UI state
  const [copied, setCopied] = useState(false);

  const supportsFileUpload = features?.includes("file-upload") ?? false;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const hasAnyInput = useMemo(() => {
    return (
      input.trim().length > 0 || fileTexts.some((t) => t.trim().length > 0)
    );
  }, [input, fileTexts]);

  function clearFiles() {
    setFileTexts([]);
    setFileNames([]);
    setUploadSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!hasAnyInput || loading) return;

    setLoading(true);
    setError(null);
    setOutput("");

    // Reset rating UI each generation
    setJustGenerated(false);
    setHoverStars(null);
    setSelectedStars(null);
    setRatingThanks(false);
    setRatingError(null);

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

    const combinedInput = [input.trim(), filesSection ? `\n\n${filesSection}` : ""]
      .filter(Boolean)
      .join("\n\n");

    try {
      const res = await fetch(`/api/tools/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ input: combinedInput }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Request failed");
      }

      const data = await res.json().catch(() => ({} as any));
      setOutput(data.output || "");
      setJustGenerated(true);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Something went wrong");
      setJustGenerated(false);
    } finally {
      setLoading(false);
    }
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
          reader.onload = () =>
            resolve(typeof reader.result === "string" ? reader.result : "");
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

      // refresh server components (top rating etc.)
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

  const fileSummary = useMemo(() => {
    if (!fileNames.length) return "No files selected";
    if (fileNames.length === 1) return fileNames[0];
    return `${fileNames.length} files selected`;
  }, [fileNames]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      {supportsFileUpload && (
        <div className="space-y-2">
          <label className="block font-medium">Upload document (optional)</label>

          {/* ✅ REAL BUTTON ONLY CLICKABLE AREA */}
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
            // ✅ Cmd/Ctrl+Enter to Generate (feels premium)
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              // trigger submit if allowed
              if (hasAnyInput && !loading) {
                // create a fake submit
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

      <div className="flex items-center justify-between gap-3">
        <button
          type="submit"
          disabled={loading || !hasAnyInput}
          className={[
            "rounded-md border px-4 py-2 font-medium",
            "border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-100",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          ].join(" ")}
        >
          {loading ? "Generating..." : "Generate"}
        </button>

        <div className="flex items-center gap-4">
          {output && justGenerated && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-300 hidden sm:inline">
                Rate output:
              </span>

              <div
                className="flex items-center gap-1"
                onMouseLeave={() => setHoverStars(null)}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    onMouseEnter={() => setHoverStars(n)}
                    className="inline-flex"
                  >
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

              {ratingSubmitting && (
                <span className="text-xs text-slate-400">Saving...</span>
              )}
              {ratingThanks && (
                <span className="text-xs text-emerald-400">Thanks!</span>
              )}
              {ratingError && (
                <span className="text-xs text-red-400">{ratingError}</span>
              )}
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

      {output && (
        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold mb-1">{outputLabel}</h3>
          </div>

          <div className="whitespace-pre-wrap border rounded-md p-3 bg-white text-black">
            {output}
          </div>
        </div>
      )}
    </form>
  );
}
