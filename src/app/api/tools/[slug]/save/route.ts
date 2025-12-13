import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

import fs from "fs";
import path from "path";

type ToolConfig = {
  slug: string;
  title: string;
  description?: string;
  category?: string;
  inputLabel?: string;
  outputLabel?: string;
};

function readToolConfig(slug: string): ToolConfig | null {
  try {
    const p = path.join(process.cwd(), "tool-configs", `${slug}.json`);
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf-8");
    return JSON.parse(raw) as ToolConfig;
  } catch {
    return null;
  }
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> } // keep Promise for your setup
) {
  const session = await auth();
  const user = session?.user as any | undefined;

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email as string },
    select: { id: true },
  });

  const userId = dbUser?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await context.params;

  // ✅ Ensure Tool exists in DB (auto-sync from tool-configs)
  const cfg = readToolConfig(slug);

  const tool = await prisma.tool.upsert({
    where: { slug },
    update: {
      // keep DB in sync if config changes
      title: cfg?.title ?? slug,
      description: cfg?.description ?? null,
      category: cfg?.category ?? null,
      inputLabel: cfg?.inputLabel ?? null,
      outputLabel: cfg?.outputLabel ?? null,
    },
    create: {
      slug,
      title: cfg?.title ?? slug,
      description: cfg?.description ?? null,
      category: cfg?.category ?? null,
      inputLabel: cfg?.inputLabel ?? null,
      outputLabel: cfg?.outputLabel ?? null,
    },
    select: { id: true, slug: true },
  });

  const existing = await prisma.savedTool.findUnique({
    where: { userId_toolId: { userId, toolId: tool.id } },
    select: { id: true },
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
