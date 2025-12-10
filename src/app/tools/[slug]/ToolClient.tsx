"use client";

import { useState } from "react";

type ToolClientProps = {
  slug: string;
  inputLabel: string;
  outputLabel: string;
  features?: string[]; // <-- NEW
};

export default function ToolClient({
  slug,
  inputLabel,
  outputLabel,
  features,
}: ToolClientProps) {
  const [input, setInput] = useState("");
  const [fileText, setFileText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);

  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supportsFileUpload = features?.includes("file-upload") ?? false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOutput("");

    // Combine textarea + file text into one input string
    const combinedInput = [
      input.trim(),
      fileText
        ? `\n\n--- Uploaded document ---\n\n${fileText.trim()}`
        : "",
    ]
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setFileText("");
      setFileName(null);
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setFileText(text);
    };
    reader.onerror = () => {
      console.error("Failed to read file");
      setError("Failed to read file. Please try again.");
      setFileText("");
      setFileName(null);
    };
    reader.readAsText(file);
  }

  const hasAnyInput = input.trim().length > 0 || fileText.trim().length > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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

      {/* FILE UPLOAD (only if tool supports it) */}
      {supportsFileUpload && (
        <div className="space-y-1">
          <label className="block font-medium mb-1">Upload document (optional)</label>
          <input
            type="file"
            accept=".txt,.md,.csv,.json,.log,.html,.xml,.pdf,.doc,.docx"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-200
                       file:mr-4 file:py-2 file:px-4
                       file:rounded-md file:border-0
                       file:bg-slate-800 file:text-slate-100
                       hover:file:bg-slate-700"
          />
          {fileName && (
            <p className="text-xs text-slate-400">Selected file: {fileName}</p>
          )}
        </div>
      )}

      {/* Buttons row */}
      <div className="flex items-center justify-between gap-3">
        {/* Generate button (left) */}
        <button
          type="submit"
          disabled={loading || !hasAnyInput}
          className="rounded-md border px-4 py-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed
                     border-slate-600 bg-slate-900 hover:bg-slate-800 text-slate-100"
        >
          {loading ? "Generating..." : "Generate"}
        </button>

        {/* Copy button (right) – only shows once output exists */}
        {output && (
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-md border px-4 py-2 font-medium disabled:opacity-50
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
  );
}
