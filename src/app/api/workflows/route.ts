import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth().catch(() => null);
  const email = session?.user?.email || null;
  const userIdFromSession = (session?.user as any)?.id as string | undefined;

  if (!email && !userIdFromSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let userId = userIdFromSession;
  if (!userId && email) {
    const u = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    userId = u?.id;
  }

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workflows = await (prisma as any).workflowProfile.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      kind: true,
      name: true,
      data: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ workflows });
}

export async function POST(req: Request) {
  const session = await auth().catch(() => null);
  const email = session?.user?.email || null;
  const userIdFromSession = (session?.user as any)?.id as string | undefined;

  if (!email && !userIdFromSession) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let userId = userIdFromSession;
  if (!userId && email) {
    const u = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    userId = u?.id;
  }
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const kind = body?.kind === "BUSINESS" ? "BUSINESS" : "PERSONAL";
  const data = body?.data ?? null;

  if (!name || !data) {
    return NextResponse.json({ error: "Missing name or data" }, { status: 400 });
  }

  const row = await (prisma as any).workflowProfile.create({
    data: { userId, name, kind, data },
    select: { id: true, kind: true, name: true, data: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ workflow: row });
}
