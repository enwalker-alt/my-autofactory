"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export default function SavedFilterButton({
  isSignedIn,
  savedCount,
}: {
  isSignedIn: boolean;
  savedCount: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const savedOn = useMemo(() => sp.get("saved") === "1", [sp]);

  async function toggle() {
    if (!isSignedIn) {
      // ✅ send them to Google sign-in and bounce back to tools with saved selected
      await signIn("google", { callbackUrl: "/tools?saved=1" });
      return;
    }

    const next = new URLSearchParams(sp.toString());
    if (savedOn) next.delete("saved");
    else next.set("saved", "1");

    const qs = next.toString();
    router.push(qs ? `/tools?${qs}` : "/tools");
    router.refresh(); // ✅ ensures server components re-fetch
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={[
        "px-4 py-2 rounded-full border text-sm transition",
        "backdrop-blur",
        savedOn
          ? "border-purple-400/40 bg-purple-500/15 text-purple-100 hover:bg-purple-500/20"
          : "border-white/10 bg-white/5 hover:bg-white/10 text-gray-100",
      ].join(" ")}
      title={isSignedIn ? "Show only saved tools" : "Sign in to view saved tools"}
    >
      Saved{isSignedIn ? ` (${savedCount})` : ""}
    </button>
  );
}
