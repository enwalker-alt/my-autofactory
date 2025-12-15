import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
const { createUploadToken } = (await import("@vercel/blob")) as any;

export const runtime = "nodejs";

export async function POST() {
  const session = await auth().catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await createUploadToken({
  pathname: "uploads/*", // REQUIRED
  allowedContentTypes: [
    "audio/mpeg",
    "audio/wav",
    "audio/mp4",
    "audio/x-m4a",
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "application/pdf",
    "text/plain",
  ],
  maximumSizeInBytes: 1024 * 1024 * 500, // 500MB
});

  return NextResponse.json({ token });
}
