// src/app/api/blob/token/route.ts

import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await auth().catch(() => null);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = session.user.email;

  const body = (await request.json()) as HandleUploadBody;

  const jsonResponse = await handleUpload({
    body,
    request,

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
        tokenPayload: JSON.stringify({
          userEmail: userEmail,
        }),
      };
    },

    onUploadCompleted: async ({ blob, tokenPayload }) => {
      console.log("Upload completed:", blob.url, tokenPayload);
      // Optional: persist blob.url to DB
    },
  });

  return NextResponse.json(jsonResponse);
}
