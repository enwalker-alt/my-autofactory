import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { handleUpload } from "@vercel/blob/client";
import type { HandleUploadBody } from "@vercel/blob/client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth().catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.body == null) {
    return NextResponse.json({ error: "No request body" }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      request,
      body: request.body as unknown as HandleUploadBody,
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
            "application/pdf",
            "text/plain",
          ],
          maximumSizeInBytes: 1024 * 1024 * 500, // 500MB
        };
      },
      onUploadCompleted: async () => {
        // optional: save blob.url to Prisma in the future
      },
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("handleUpload error:", err);
    return NextResponse.json(
      { error: "Upload failed", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
