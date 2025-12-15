import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth().catch(() => null);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,

      // Runs BEFORE the client gets a token
      onBeforeGenerateToken: async (pathname) => {
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
          tokenPayload: JSON.stringify({
            userEmail: session?.user?.email ?? "",
            pathname,
          }),
        };
      },

      // Optional: runs AFTER upload completes (Vercel calls this)
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // console.log("Upload complete:", blob.url, tokenPayload);
        // TODO: optionally write blob.url to your DB
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err: any) {
    console.error("Blob token route error:", err);
    return NextResponse.json(
      { error: err?.message || "Blob token route failed" },
      { status: 500 }
    );
  }
}
