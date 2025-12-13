import { PrismaClient } from "../generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  (() => {
    const connectionString = process.env.DIRECT_DATABASE_URL;

    if (!connectionString) {
      throw new Error("Missing DIRECT_DATABASE_URL in .env.local");
    }

    const adapter = new PrismaNeon({ connectionString });

    return new PrismaClient({
      adapter,
      log: ["error", "warn"],
    });
  })();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
