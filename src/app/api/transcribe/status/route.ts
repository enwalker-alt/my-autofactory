import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ASSEMBLY_API = "https://api.assemblyai.com/v2";

export async function GET(req: Request) {
  if (!process.env.ASSEMBLYAI_API_KEY) {
    return NextResponse.json(
      { error: "Missing ASSEMBLYAI_API_KEY" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const r = await fetch(`${ASSEMBLY_API}/transcript/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: {
      Authorization: process.env.ASSEMBLYAI_API_KEY,
    },
    cache: "no-store",
  });

  if (!r.ok) {
    const err = await r.text().catch(() => "");
    return NextResponse.json(
      { error: `AssemblyAI status fetch failed: ${err || r.statusText}` },
      { status: 500 }
    );
  }

  const j: any = await r.json().catch(() => ({}));

  const status = String(j?.status || "");
  const text = String(j?.text || "");
  const error = String(j?.error || "");

  return NextResponse.json({
    id,
    status, // queued | processing | completed | error
    text,
    error,
  });
}
