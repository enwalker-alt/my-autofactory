import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function POST(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  // ✅ Get session
  const session = await auth();
  const user = session?.user as any | undefined;

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ✅ ALWAYS get userId from DB (reliable even if session has no id)
  const dbUser = await prisma.user.findUnique({
    where: { email: user.email as string },
    select: { id: true },
  });

  const userId = dbUser?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = params;

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
    return NextResponse.json({ saved: false });
  }

  await prisma.savedTool.create({
    data: { userId, toolId: tool.id },
  });

  revalidatePath("/tools");
  return NextResponse.json({ saved: true });
}
