"use client";

import { useState } from "react";
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
}: {
  filled: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        "text-lg leading-none",
        disabled ? "opacity-60 cursor-not-allowed" : "hover:scale-[1.06]",
        "transition",
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
  const { data: session } = useSession();

  const [input, setInput] = useState("");
  const [fileTexts, setFileTexts] = useState<string[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ rating (inline, post-generation)
  const [justGenerated, setJustGenerated] = useState(false);
  const [hoverStars, setHoverStars] = useState<number | null>(null);
  const [selectedStars, setSelectedStars] = useState<number | null>(null);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingThanks, setRatingThanks] = useState(false);

  const supportsFileUpload = features?.includes("file-upload") ?? false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOutput("");

    // reset rating UI each generation
    setJustGenerated(false);
    setHoverStars(null);
    setSelectedStars(null);
    setRatingThanks(false);

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
        body: JSON.stringify({ input: combinedInput }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Request failed");
      }

      const data = await res.json();
      setOutput(data.output || "");

      // ✅ show rating row only after we actually have output
      setJustGenerated(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong");
      setJustGenerated(false);
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!output) return;
    navigator.clipboard.writeText(output).catch((err) =>
      console.error("Failed to copy:", err)
    );
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);

    if (!files.length) {
      setFileTexts([]);
      setFileNames([]);
      setUploadSuccess(false);
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
      setFileTexts([]);
      setFileNames([]);
      setUploadSuccess(false);
      return;
    }

    try {
      const readFileAsText = (file: File) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve(typeof reader.result === "string" ? reader.result : "");
          };
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
      setFileTexts([]);
      setFileNames([]);
      setUploadSuccess(false);
    }
  }

  const hasAnyInput =
    input.trim().length > 0 || fileTexts.some((t) => t.trim().length > 0);

  async function submitRating(value: number) {
    // signed out => sign in, then they can click again
    if (!session?.user) {
      await signIn("google", { callbackUrl: `/tools/${slug}` });
      return;
    }

    setSelectedStars(value);
    setRatingSubmitting(true);
    setRatingThanks(false);

    try {
      const res = await fetch(`/api/tools/${slug}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
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

      setRatingThanks(true);
      // tiny auto-hide "Thanks" after a moment (optional)
      window.setTimeout(() => setRatingThanks(false), 1800);
    } catch (e) {
      console.error(e);
      // don’t hard-fail the whole tool, just show a small message
      setRatingThanks(false);
    } finally {
      setRatingSubmitting(false);
    }
  }

  const displayStars = hoverStars ?? selectedStars ?? 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      {/* FILE UPLOAD FIRST (if supported) */}
      {supportsFileUpload && (
        <div className="space-y-1">
          <label className="block font-medium mb-1">
            Upload document (optional)
          </label>
          <input
            type="file"
            multiple
            accept=".txt,.md,.csv,.json,.log,.html,.xml"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-200
                       file:mr-4 file:py-2 file:px-4
                       file:rounded-md file:border-0
                       file:bg-slate-800 file:text-slate-100
                       hover:file:bg-slate-700"
          />

          {uploadSuccess && fileNames.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 mt-1">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-black">
                ✓
              </span>
              <span>
                {fileNames.length} file{fileNames.length > 1 ? "s" : ""} ready
              </span>
            </div>
          )}

          {fileNames.length > 0 && (
            <ul className="mt-1 text-[11px] text-slate-400 space-y-0.5">
              {fileNames.map((name) => (
                <li key={name} className="truncate">
                  {name}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* TEXT INPUT */}
      <div>
        <label className="block font-medium mb-1">{inputLabel}</label>
        <textarea
          className="w-full border rounded-md p-2 min-h-[160px] bg-slate-900/60 text-slate-100 placeholder:text-slate-500"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste or type your text here..."
        />
      </div>

      {/* Buttons row */}
      <div className="flex items-center justify-between gap-3">
        {/* Generate */}
        <button
          type="submit"
          disabled={loading || !hasAnyInput}
          className="rounded-md border px-4 py-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed
                     border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-100"
        >
          {loading ? "Generating..." : "Generate"}
        </button>

        {/* Right side: inline rating (after generation) + copy */}
        <div className="flex items-center gap-3">
          {/* ✅ Inline rating prompt (NO POPUP) */}
          {output && justGenerated && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 hidden sm:inline">
                Rate output:
              </span>

              <div
                className="flex items-center gap-0.5"
                onMouseLeave={() => setHoverStars(null)}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    onMouseEnter={() => setHoverStars(n)}
                    className="inline-flex"
                  >
                    <Star
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
                <span className="text-[11px] text-slate-500">Saving...</span>
              )}
              {ratingThanks && (
                <span className="text-[11px] text-emerald-400">Thanks!</span>
              )}
            </div>
          )}

          {/* Copy */}
          {output && (
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-md border px-4 py-2 font-medium
                         border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-100"
            >
              Copy
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {output && (
        <div>
          <h3 className="font-semibold mb-1">{outputLabel}</h3>
          <div className="whitespace-pre-wrap border rounded-md p-3 bg-white text-black">
            {output}
          </div>
        </div>
      )}
    </form>
  );
}
