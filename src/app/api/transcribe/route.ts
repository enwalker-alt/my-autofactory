import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ASSEMBLY_API = "https://api.assemblyai.com/v2";

type TranscribeBody = {
  // Preferred: pass the Vercel Blob URL (or any https URL) to fetch server-side
  blobUrl?: string;

  // Back-compat / alternate naming
  fileUrl?: string;
  url?: string;

  // Optional: client can pass this, but we’ll also sniff from response headers
  mimeType?: string;
};

function isSupportedMediaType(mime?: string) {
  if (!mime) return true; // allow unknown; we’ll still try
  return mime.startsWith("audio/") || mime.startsWith("video/");
}

export async function POST(req: Request) {
  if (!process.env.ASSEMBLYAI_API_KEY) {
    return NextResponse.json(
      { error: "Missing ASSEMBLYAI_API_KEY" },
      { status: 500 }
    );
  }

  // We now expect JSON, not multipart/form-data.
  let body: TranscribeBody;
  try {
    body = (await req.json()) as TranscribeBody;
  } catch {
    return NextResponse.json(
      {
        error:
          "Expected application/json with { blobUrl } (or { fileUrl } / { url }).",
      },
      { status: 400 }
    );
  }

  const blobUrl = body.blobUrl || body.fileUrl || body.url;
  if (!blobUrl || typeof blobUrl !== "string") {
    return NextResponse.json(
      { error: "blobUrl required (string)" },
      { status: 400 }
    );
  }

  // 1) Fetch the media from the provided URL
  const fileRes = await fetch(blobUrl);
  if (!fileRes.ok) {
    const err = await fileRes.text().catch(() => "");
    return NextResponse.json(
      { error: `Failed to fetch blobUrl: ${err || fileRes.statusText}` },
      { status: 400 }
    );
  }

  const contentType =
    body.mimeType ||
    fileRes.headers.get("content-type") ||
    "application/octet-stream";

  // Optional: restrict to media only
  if (!isSupportedMediaType(contentType)) {
    return NextResponse.json(
      {
        error: `Unsupported content-type (${contentType}). Provide audio/video only.`,
      },
      { status: 400 }
    );
  }

  // Optional: size limit check (when available)
  const contentLength = fileRes.headers.get("content-length");
  if (contentLength) {
    const sizeBytes = Number(contentLength);
    if (!Number.isNaN(sizeBytes)) {
      const MAX_MB = 50;
      const sizeMB = sizeBytes / (1024 * 1024);
      if (sizeMB > MAX_MB) {
        return NextResponse.json(
          { error: `File too large (${sizeMB.toFixed(1)}MB). Max is ${MAX_MB}MB.` },
          { status: 400 }
        );
      }
    }
  }

  const buf = Buffer.from(await fileRes.arrayBuffer());

  // 2) Upload binary to AssemblyAI
  const uploadRes = await fetch(`${ASSEMBLY_API}/upload`, {
    method: "POST",
    headers: {
      Authorization: process.env.ASSEMBLYAI_API_KEY,
      "Content-Type": "application/octet-stream",
    },
    body: buf,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text().catch(() => "");
    return NextResponse.json(
      { error: `AssemblyAI upload failed: ${err || uploadRes.statusText}` },
      { status: 500 }
    );
  }

  const uploadJson: any = await uploadRes.json().catch(() => ({}));
  const uploadUrl = String(uploadJson?.upload_url || "");
  if (!uploadUrl) {
    return NextResponse.json(
      { error: "AssemblyAI upload did not return upload_url" },
      { status: 500 }
    );
  }

  // 3) Start transcript job
  const startRes = await fetch(`${ASSEMBLY_API}/transcript`, {
    method: "POST",
    headers: {
      Authorization: process.env.ASSEMBLYAI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      audio_url: uploadUrl,
      punctuate: true,
      format_text: true,
      // Optional knobs:
      // speaker_labels: true,
      // auto_chapters: true,
    }),
  });

  if (!startRes.ok) {
    const err = await startRes.text().catch(() => "");
    return NextResponse.json(
      { error: `AssemblyAI transcript start failed: ${err || startRes.statusText}` },
      { status: 500 }
    );
  }

  const startJson: any = await startRes.json().catch(() => ({}));
  const id = String(startJson?.id || "");
  if (!id) {
    return NextResponse.json(
      { error: "AssemblyAI did not return transcript id" },
      { status: 500 }
    );
  }

  // Return quickly — client polls your status endpoint
  return NextResponse.json({ id, status: "processing" });
}
