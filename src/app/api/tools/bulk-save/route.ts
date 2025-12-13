import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth().catch(() => null);
  const email = session?.user?.email as string | undefined;
  let userId = (session?.user as any)?.id as string | undefined;

  if (!userId && email) {
    const dbUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    userId = dbUser?.id;
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { slugs?: string[] };
  const slugs = Array.isArray(body.slugs)
    ? body.slugs.map((s) => String(s).trim()).filter(Boolean)
    : [];

  if (slugs.length === 0) {
    return NextResponse.json({ error: "No slugs provided" }, { status: 400 });
  }

  // Ensure Tool rows exist
  const existing = await prisma.tool.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  const existingMap = new Map(existing.map((t) => [t.slug, t.id]));

  const missingSlugs = slugs.filter((s) => !existingMap.has(s));

  if (missingSlugs.length > 0) {
    // If your tools are always in DB already, this won't run often.
    await prisma.tool.createMany({
      data: missingSlugs.map((slug) => ({
        slug,
        title: slug,
        description: null,
        inputLabel: null,
        outputLabel: null,
      })),
      skipDuplicates: true,
    });

    const created = await prisma.tool.findMany({
      where: { slug: { in: missingSlugs } },
      select: { id: true, slug: true },
    });
    created.forEach((t) => existingMap.set(t.slug, t.id));
  }

  const toolIds = slugs.map((s) => existingMap.get(s)).filter(Boolean) as string[];

  await prisma.savedTool.createMany({
    data: toolIds.map((toolId) => ({ userId, toolId })),
    skipDuplicates: true,
  });

  return NextResponse.json({ ok: true, saved: slugs });
}
