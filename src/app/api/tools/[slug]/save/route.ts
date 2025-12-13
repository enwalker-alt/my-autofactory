import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";



export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any)?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;

  const tool = await prisma.tool.findUnique({ where: { slug } });
  if (!tool) return NextResponse.json({ error: "Tool not found" }, { status: 404 });

  const existing = await prisma.savedTool.findUnique({
    where: { userId_toolId: { userId: userId, toolId: tool.id } },
  });

  if (existing) {
    await prisma.savedTool.delete({ where: { id: existing.id } });
    return NextResponse.json({ saved: false });
  }

  await prisma.savedTool.create({
    data: { userId: userId, toolId: tool.id },
  });

  return NextResponse.json({ saved: true });
}
