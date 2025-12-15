import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth().catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional: add per-user rate limiting / quotas here

  const { createUploadToken } = (await import("@vercel/blob")) as any;
  const token = await createUploadToken({
    allowedContentTypes: [
      "audio/mpeg",
      "audio/wav",
      "audio/mp4",
      "audio/x-m4a",
      "video/mp4",
      "video/quicktime",
      "video/webm",
    ],
    // Optional: set max size (in bytes) — adjust as you like
    maximumSizeInBytes: 1024 * 1024 * 500, // 500MB
  });

  return NextResponse.json({ token });
}
