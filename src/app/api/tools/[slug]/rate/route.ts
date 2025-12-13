import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    const email = (session as any)?.user?.email as string | undefined;

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await context.params;

    const body = await req.json().catch(() => ({}));
    const valueRaw = body?.value;

    const value = Number(valueRaw);
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!dbUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tool = await prisma.tool.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!tool?.id) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    // ✅ Upsert rating, then recompute aggregates
    const result = await prisma.$transaction(async (tx) => {
      await tx.toolRating.upsert({
        where: { userId_toolId: { userId: dbUser.id, toolId: tool.id } },
        update: { value },
        create: { userId: dbUser.id, toolId: tool.id, value },
      });

      const agg = await tx.toolRating.aggregate({
        where: { toolId: tool.id },
        _avg: { value: true },
        _count: { value: true },
      });

      const ratingAvg = agg._avg.value ?? 0;
      const ratingCount = agg._count.value ?? 0;

      await tx.tool.update({
        where: { id: tool.id },
        data: { ratingAvg, ratingCount },
      });

      return { ratingAvg, ratingCount };
    });

    revalidatePath("/tools");
    revalidatePath(`/tools/${slug}`);

    return NextResponse.json({
      ok: true,
      ratingAvg: result.ratingAvg,
      ratingCount: result.ratingCount,
    });
  } catch (err: any) {
    console.error("Rate route crashed:", err?.message || err);
    return NextResponse.json(
      { error: "Rate route crashed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
