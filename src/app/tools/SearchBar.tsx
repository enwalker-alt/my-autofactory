"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export default function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = searchParams.get("q") ?? "";

  const [value, setValue] = useState(initial);

  // 🔥 Update URL automatically as the user types (live search)
  useEffect(() => {
    const timeout = setTimeout(() => {
      const params = new URLSearchParams();
      if (value.trim().length > 0) params.set("q", value.trim());
      router.replace(`/tools?${params.toString()}`);
    }, 200);

    return () => clearTimeout(timeout);
  }, [value]);

  return (
    <div className="relative w-full max-w-md mx-auto">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z"
          />
        </svg>
      </span>

      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search tools by name or description..."
        className="w-full rounded-2xl bg-white/5 border border-white/10 px-10 py-2.5 text-sm text-gray-100 placeholder:text-gray-500 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/40"
      />
    </div>
  );
}
