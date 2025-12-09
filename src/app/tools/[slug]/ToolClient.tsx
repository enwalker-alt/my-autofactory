"use client";

import { useState } from "react";

type ToolClientProps = {
  slug: string;
  inputLabel: string;
  outputLabel: string;
};

export default function ToolClient({
  slug,
  inputLabel,
  outputLabel,
}: ToolClientProps) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOutput("");

    try {
      const res = await fetch(`/api/tools/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-4">
      <div>
        <label className="block font-medium mb-1">{inputLabel}</label>
        <textarea
          className="w-full border rounded-md p-2 min-h-[160px]"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste or type your text here..."
        />
      </div>

      <button
        type="submit"
        disabled={loading || !input.trim()}
        className="rounded-md border px-4 py-2 font-medium disabled:opacity-50"
      >
        {loading ? "Generating..." : "Generate"}
      </button>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {output && (
        <div>
          <h3 className="font-semibold mb-1">{outputLabel}</h3>
          <div className="whitespace-pre-wrap border rounded-md p-3 bg-gray-50">
            {output}
          </div>
        </div>
      )}
    </form>
  );
}
