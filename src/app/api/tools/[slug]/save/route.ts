export const runtime = "nodejs"; // ✅ ensure not edge
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    const user = session?.user as any | undefined;

    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized (no session email)" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: String(user.email) },
      select: { id: true },
    });

    if (!dbUser?.id) {
      return NextResponse.json({ error: "Unauthorized (user not found in DB)" }, { status: 401 });
    }

    const { slug } = await context.params;

    // ✅ DO NOT depend on tool-configs here (fs can break / be edge)
    // Create tool row if missing so saving always works.
    const tool = await prisma.tool.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        title: slug,          // you can later sync real title/desc via your sync script
        description: null,
        category: null,
        inputLabel: null,
        outputLabel: null,
      },
      select: { id: true },
    });

    const existing = await prisma.savedTool.findUnique({
      where: { userId_toolId: { userId: dbUser.id, toolId: tool.id } },
      select: { id: true },
    });

    if (existing) {
      await prisma.savedTool.delete({ where: { id: existing.id } });
      revalidatePath("/tools");
      revalidatePath("/saved");
      return NextResponse.json({ saved: false });
    }

    await prisma.savedTool.create({
      data: { userId: dbUser.id, toolId: tool.id },
    });

    revalidatePath("/tools");
    revalidatePath("/saved");
    return NextResponse.json({ saved: true });
  } catch (err: any) {
    console.error("SAVE ROUTE ERROR:", err);
    return NextResponse.json(
      { error: "Save route crashed", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
