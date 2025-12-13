"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

type ToolClientProps = {
  slug: string;
  inputLabel: string;
  outputLabel: string;
  features?: string[];
  isSignedIn?: boolean; // ✅ NEW (passed from page.tsx)
};

export default function ToolClient({
  slug,
  inputLabel,
  outputLabel,
  features,
  isSignedIn = false,
}: ToolClientProps) {
  const [input, setInput] = useState("");
  const [fileTexts, setFileTexts] = useState<string[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Rating modal state
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingHover, setRatingHover] = useState<number | null>(null);
  const [ratingValue, setRatingValue] = useState<number | null>(null);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingMsg, setRatingMsg] = useState<string | null>(null);

  const supportsFileUpload = features?.includes("file-upload") ?? false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOutput("");

    // Combine textarea + all file texts
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
      const out = data.output || "";
      setOutput(out);

      // ✅ After successful generate, open rating prompt
      // Reset rating state each time so it shows every Generate
      setRatingValue(null);
      setRatingHover(null);
      setRatingMsg(null);
      setRatingOpen(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Something went wrong");
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
    if (!isSignedIn) {
      setRatingMsg("Sign in to rate tools.");
      return;
    }

    setRatingSubmitting(true);
    setRatingMsg(null);

    try {
      const res = await fetch(`/api/tools/${slug}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ value }),
      });

      if (res.status === 401) {
        setRatingMsg("Please sign in to rate tools.");
        return;
      }

      if (!res.ok) {
        const bodyText = await res.text().catch(() => "");
        throw new Error(bodyText || "Rating failed");
      }

      setRatingMsg("Thanks — rating saved.");
      // keep open briefly or close immediately — your call:
      setTimeout(() => setRatingOpen(false), 650);
    } catch (e: any) {
      console.error(e);
      setRatingMsg(e?.message || "Rating failed.");
    } finally {
      setRatingSubmitting(false);
    }
  }

  return (
    <>
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
          <button
            type="submit"
            disabled={loading || !hasAnyInput}
            className="rounded-md border px-4 py-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed
                     border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-100"
          >
            {loading ? "Generating..." : "Generate"}
          </button>

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

      {/* ✅ Rating modal (shows after each successful Generate) */}
      {ratingOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4"
          onMouseDown={() => {
            if (!ratingSubmitting) setRatingOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1220] p-5 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-slate-100">
                  Rate this tool
                </h4>
                <p className="mt-1 text-xs text-slate-300/80">
                  Quick feedback helps Atlas improve.
                </p>
              </div>

              <button
                type="button"
                className="text-slate-400 hover:text-slate-200"
                onClick={() => setRatingOpen(false)}
                disabled={ratingSubmitting}
                aria-label="Close rating"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => {
                const active = (ratingHover ?? ratingValue ?? 0) >= n;
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={ratingSubmitting}
                    onMouseEnter={() => setRatingHover(n)}
                    onMouseLeave={() => setRatingHover(null)}
                    onClick={() => setRatingValue(n)}
                    className={[
                      "text-2xl transition",
                      active ? "text-yellow-300" : "text-slate-500",
                      ratingSubmitting ? "opacity-60 cursor-not-allowed" : "hover:scale-[1.06]",
                    ].join(" ")}
                    aria-label={`${n} star`}
                  >
                    ★
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              {!isSignedIn ? (
                <button
                  type="button"
                  onClick={() => signIn("google", { callbackUrl: `/tools/${slug}` })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10 transition"
                >
                  Sign in to rate
                </button>
              ) : (
                <button
                  type="button"
                  disabled={ratingSubmitting || !ratingValue}
                  onClick={() => ratingValue && submitRating(ratingValue)}
                  className="w-full rounded-xl border border-purple-400/30 bg-purple-500/15 px-4 py-2 text-sm font-semibold text-purple-100 hover:bg-purple-500/20 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {ratingSubmitting ? "Saving..." : "Submit rating"}
                </button>
              )}
            </div>

            {ratingMsg && (
              <div className="mt-3 text-center text-xs text-slate-300/80">
                {ratingMsg}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
