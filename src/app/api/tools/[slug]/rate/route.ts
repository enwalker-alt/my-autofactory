import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;

    const session = await auth();
    const email = (session as any)?.user?.email as string | undefined;

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const valueRaw = body?.value;

    const value = Number(valueRaw);
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      return NextResponse.json({ error: "Invalid rating (1..5)" }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!dbUser?.id) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ✅ ensure tool exists
    const tool = await prisma.tool.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!tool?.id) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    // ✅ upsert user's rating for this tool
    await prisma.toolRating.upsert({
      where: { userId_toolId: { userId: dbUser.id, toolId: tool.id } },
      update: { value },
      create: { userId: dbUser.id, toolId: tool.id, value },
      select: { id: true },
    });

    // ✅ recompute rollup and store on Tool for fast reads everywhere
    const agg = await prisma.toolRating.aggregate({
      where: { toolId: tool.id },
      _avg: { value: true },
      _count: { value: true },
    });

    const avg = Number(agg._avg.value ?? 0);
    const count = Number(agg._count.value ?? 0);

    const updated = await prisma.tool.update({
      where: { id: tool.id },
      data: {
        ratingAvg: avg,
        ratingCount: count,
      },
      select: { ratingAvg: true, ratingCount: true },
    });

    return NextResponse.json({
      ok: true,
      yourRating: value,
      avgRating: updated.ratingAvg,
      ratingCount: updated.ratingCount,
    });
  } catch (err: any) {
    console.error("rate route error:", err);
    return NextResponse.json(
      { error: "Rate route crashed", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
