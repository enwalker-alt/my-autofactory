import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function resolveUserId() {
  const session = await auth().catch(() => null);
  const email = session?.user?.email || null;
  const userIdFromSession = (session?.user as any)?.id as string | undefined;

  if (userIdFromSession) return { userId: userIdFromSession };
  if (!email) return { userId: null };

  const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return { userId: u?.id ?? null };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await resolveUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);

  const name = typeof body?.name === "string" ? body.name.trim() : undefined;
  const kind =
    body?.kind === "BUSINESS" ? "BUSINESS" : body?.kind === "PERSONAL" ? "PERSONAL" : undefined;
  const data = body?.data ?? undefined;

  const existing = await (prisma as any).workflowProfile.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await (prisma as any).workflowProfile.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(kind ? { kind } : {}),
      ...(data !== undefined ? { data } : {}),
    },
    select: { id: true, kind: true, name: true, data: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ workflow: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await resolveUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const existing = await (prisma as any).workflowProfile.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await (prisma as any).workflowProfile.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
