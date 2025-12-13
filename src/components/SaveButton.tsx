"use client";

import { useEffect, useState } from "react";

export default function SaveButton({
  slug,
  initialSaved,
  isSignedIn,
}: {
  slug: string;
  initialSaved: boolean;
  isSignedIn: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSaved(initialSaved);
  }, [initialSaved]);

  async function toggleSave() {
    if (!isSignedIn) {
      window.location.href = "/signin";
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/tools/${slug}/save`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Failed to save");

      setSaved(!!data.saved);
    } catch (e) {
      console.error(e);
      alert("Could not update saved status. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggleSave}
      disabled={loading}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
        saved
          ? "border-violet-400/40 bg-violet-500/15 text-violet-100 hover:bg-violet-500/20"
          : "border-white/10 bg-white/5 text-slate-100 hover:bg-white/10",
        loading ? "opacity-60 cursor-not-allowed" : "",
      ].join(" ")}
      title={isSignedIn ? "Save this tool" : "Sign in to save tools"}
    >
      <span className="text-base leading-none">{saved ? "★" : "☆"}</span>
      <span>{saved ? "Saved" : "Save"}</span>
    </button>
  );
}
