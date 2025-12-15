import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ASSEMBLY_API = "https://api.assemblyai.com/v2";

export async function GET(req: Request) {
  if (!process.env.ASSEMBLYAI_API_KEY) {
    return NextResponse.json({ error: "Missing ASSEMBLYAI_API_KEY" }, { status: 500 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const pollRes = await fetch(`${ASSEMBLY_API}/transcript/${id}`, {
    headers: { Authorization: process.env.ASSEMBLYAI_API_KEY },
    cache: "no-store",
  });

  if (!pollRes.ok) {
    const err = await pollRes.text().catch(() => "");
    return NextResponse.json(
      { error: `AssemblyAI poll failed: ${err || pollRes.statusText}` },
      { status: 500 }
    );
  }

  const data: any = await pollRes.json().catch(() => ({}));
  const status = String(data?.status || "processing");

  if (status === "completed") {
    return NextResponse.json({ status, text: String(data?.text || "") });
  }

  if (status === "error") {
    return NextResponse.json(
      { status, error: String(data?.error || "Transcription failed") },
      { status: 500 }
    );
  }

  return NextResponse.json({ status });
}
