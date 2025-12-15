import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { handleUpload } from "@vercel/blob/client";
import type { HandleUploadBody } from "@vercel/blob/client";

export const runtime = "nodejs";

export async function OPTIONS() {
  // usually not needed for same-origin, but harmless
  return new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const session = await auth().catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await handleUpload({
      request,
      body: (await request.formData()) as unknown as HandleUploadBody,
      onBeforeGenerateToken: async () => {
        return {
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
        };
      },
      onUploadCompleted: async () => {
        // optional: update DB with blob.url
      },
    });

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("Blob token error:", err);
    return NextResponse.json(
      { error: "Upload token failed", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
