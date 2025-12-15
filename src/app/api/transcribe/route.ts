import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ASSEMBLY_API = "https://api.assemblyai.com/v2";

export async function POST(req: Request) {
  if (!process.env.ASSEMBLYAI_API_KEY) {
    return NextResponse.json({ error: "Missing ASSEMBLYAI_API_KEY" }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data (file upload)" },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  // Optional: restrict to media only
  const isMedia = file.type?.startsWith("audio/") || file.type?.startsWith("video/");
  if (!isMedia) {
    return NextResponse.json(
      { error: `Unsupported file type (${file.type || "unknown"}). Upload audio/video only.` },
      { status: 400 }
    );
  }

  const MAX_MB = 50;
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > MAX_MB) {
    return NextResponse.json(
      { error: `File too large (${sizeMB.toFixed(1)}MB). Max is ${MAX_MB}MB.` },
      { status: 400 }
    );
  }

  // 1) Upload binary
  const buf = Buffer.from(await file.arrayBuffer());

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

  // 2) Start transcript
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
      // Optional knobs you might like later:
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
    return NextResponse.json({ error: "AssemblyAI did not return transcript id" }, { status: 500 });
  }

  // Return quickly — client polls status endpoint
  return NextResponse.json({ id, status: "processing" });
}
