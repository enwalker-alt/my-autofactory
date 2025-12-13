import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function POST(
  _req: NextRequest,
  { params }: { params: { slug: string } } // ✅ NOT a Promise
) {
  const session = await auth();
  const user = session?.user as any | undefined;

  // if your session stores email, this is fine:
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ✅ Always resolve userId from DB (works even if session has no id)
  const dbUser = await prisma.user.findUnique({
    where: { email: user.email as string },
    select: { id: true },
  });

  const userId = dbUser?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = params.slug; // ✅ no await

  const tool = await prisma.tool.findUnique({ where: { slug } });
  if (!tool) {
    return NextResponse.json({ error: "Tool not found" }, { status: 404 });
  }

  const existing = await prisma.savedTool.findUnique({
    where: { userId_toolId: { userId, toolId: tool.id } },
  });

  if (existing) {
    await prisma.savedTool.delete({ where: { id: existing.id } });
    revalidatePath("/tools");
    revalidatePath("/saved");
    return NextResponse.json({ saved: false });
  }

  await prisma.savedTool.create({
    data: { userId, toolId: tool.id },
  });

  revalidatePath("/tools");
  revalidatePath("/saved");
  return NextResponse.json({ saved: true });
}
