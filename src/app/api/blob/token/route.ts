import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://my-autofactory.vercel.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST() {
  const session = await auth().catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

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
    maximumSizeInBytes: 1024 * 1024 * 500, // 500MB
  });

  return NextResponse.json({ token }, { headers: corsHeaders });
}
