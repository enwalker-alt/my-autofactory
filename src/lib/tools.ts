import { prisma } from "@/lib/prisma";

export async function getTools(category?: string) {
  return prisma.tool.findMany({
    where: category ? { category } : {},
    orderBy: { updatedAt: "desc" },
  });
}
