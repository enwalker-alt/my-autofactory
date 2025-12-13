"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function SaveButton({
  slug,
  initialSaved,
  isSignedIn,
}: {
  slug: string;
  initialSaved: boolean;
  isSignedIn: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [saved, setSaved] = useState<boolean>(initialSaved);

  // keep in sync if user navigates and server sends a different initialSaved
  useEffect(() => setSaved(initialSaved), [initialSaved]);

  async function onToggle() {
    if (!isSignedIn) {
      await signIn("google", { callbackUrl: `/tools/${slug}` });
      return;
    }

    const was = saved;
    setSaved(!was); // optimistic

    try {
      const res = await fetch(`/api/tools/${slug}/save`, {
        method: "POST",
        cache: "no-store",
      });

      if (res.status === 401) {
        setSaved(was);
        await signIn("google", { callbackUrl: `/tools/${slug}` });
        return;
      }

      if (!res.ok) {
        setSaved(was);
        return;
      }

      const data = (await res.json()) as { saved?: boolean };
      if (typeof data.saved === "boolean") setSaved(data.saved);

      // refresh server data (breadcrumb / “Not saved” text / counts elsewhere)
      startTransition(() => router.refresh());
    } catch {
      setSaved(was);
    }
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isPending}
      className={[
        "inline-flex items-center gap-2 rounded-full border px-4 py-2",
        "text-sm sm:text-base font-medium",
        saved
          ? "border-purple-400/40 bg-purple-500/15 text-purple-100 hover:bg-purple-500/20"
          : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/25",
        "shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20",
        "transition",
        isPending ? "opacity-70 cursor-not-allowed" : "",
      ].join(" ")}
      aria-pressed={saved}
      title={isSignedIn ? (saved ? "Saved" : "Save tool") : "Sign in to save"}
    >
      <span className="text-base leading-none">{saved ? "★" : "☆"}</span>
      <span>{saved ? "Saved" : "Save"}</span>
    </button>
  );
}
