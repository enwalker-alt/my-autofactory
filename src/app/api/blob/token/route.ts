import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await auth().catch(() => null);
    if (!session?.user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const mod: any = await import("@vercel/blob");

    // IMPORTANT: use the function that actually exists in your installed version
    const createUploadToken =
      mod.createUploadToken ?? mod.createUploadToken?.default ?? mod.createUploadToken;

    if (!createUploadToken) {
      return NextResponse.json(
        { ok: false, error: "createUploadToken not found", keys: Object.keys(mod) },
        { status: 500 }
      );
    }

    const token = await createUploadToken({
      // REQUIRED (don’t skip this)
      pathname: "uploads/*",

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

      // NOTE: naming differences exist across versions
      maximumSizeInBytes: 1024 * 1024 * 500,
    });

    return NextResponse.json({ ok: true, token });
  } catch (err: any) {
    console.error("BLOB TOKEN ERROR:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Upload token failed",
        message: err?.message ?? String(err),
        name: err?.name,
        stack: err?.stack,
      },
      { status: 500 }
    );
  }
}
