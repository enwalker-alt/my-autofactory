import fs from "fs";
import path from "path";
import Link from "next/link";
import SearchBar from "./SearchBar";
import ToolLibraryClient from "./ToolLibraryClient";
import CategoryPicker from "./CategoryPicker";
import SavedFilterButton from "./SavedFilterButton";
import AuthPill from "@/components/AuthPill";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ToolMeta = {
  slug: string;
  title: string;
  description: string;
  avgRating?: number | null;
  ratingCount?: number | null;
};

function getToolsFromConfigs(): ToolMeta[] {
  const configDir = path.join(process.cwd(), "tool-configs");
  const files = fs.readdirSync(configDir).filter((file) => file.endsWith(".json"));

  return files
    .map((file) => {
      const filePath = path.join(configDir, file);
      const content = fs.readFileSync(filePath, "utf-8");
      const json = JSON.parse(content);

      return {
        slug: json.slug,
        title: json.title,
        description: json.description,
        avgRating: null,
        ratingCount: null,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    page?: string;
    sort?: string;
    q?: string;
    category?: string;
  }>;
}) {
  let tools = getToolsFromConfigs();

  // ✅ Pull ratings + ensure DB rows exist
  try {
    const slugs = tools.map((t) => t.slug);

    const rows = await prisma.tool.findMany({
      where: { slug: { in: slugs } },
      select: {
        slug: true,
        ratingAvg: true,
        ratingCount: true,
      },
    });

    const rowMap = new Map(rows.map((r) => [r.slug, r]));

    const missing = tools.filter((t) => !rowMap.has(t.slug));
    if (missing.length > 0) {
      await prisma.tool.createMany({
        data: missing.map((t) => ({
          slug: t.slug,
          title: t.title,
          description: t.description ?? null,
          inputLabel: null,
          outputLabel: null,
        })),
        skipDuplicates: true,
      });

      const rows2 = await prisma.tool.findMany({
        where: { slug: { in: slugs } },
        select: {
          slug: true,
          ratingAvg: true,
          ratingCount: true,
        },
      });
      rows2.forEach((r) => rowMap.set(r.slug, r));
    }

    tools = tools.map((t) => {
      const r = rowMap.get(t.slug);
      return {
        ...t,
        avgRating: r?.ratingAvg ?? null,
        ratingCount: r?.ratingCount ?? null,
      };
    });
  } catch {
    // DB failure should never break browsing
  }

  const sp = await searchParams;
  const savedOn = sp?.saved === "1";

  let userId: string | undefined;
  let isSignedIn = false;
  let savedSlugs: string[] = [];

  let session: any = null;
  try {
    session = await auth();
  } catch {}

  const email = session?.user?.email as string | undefined;
  userId = session?.user?.id as string | undefined;

  if (!userId && email) {
    const dbUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    userId = dbUser?.id;
  }

  isSignedIn = !!userId;

  if (userId) {
    const saved = await prisma.savedTool.findMany({
      where: { userId },
      select: { tool: { select: { slug: true } } },
      orderBy: { createdAt: "desc" },
    });

    savedSlugs = saved
      .map((s) => s.tool?.slug)
      .filter((slug): slug is string => !!slug);
  }

  if (savedOn) {
    tools = isSignedIn ? tools.filter((t) => new Set(savedSlugs).has(t.slug)) : [];
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#050816] via-[#020617] to-black text-gray-100">
      {/* ✅ keep login top-right WITHOUT pushing content down */}
      <div className="fixed top-4 right-4 z-50">
        <AuthPill />
      </div>

      {/* ✅ wider container + less top padding = less dead space */}
      <div className="max-w-7xl mx-auto px-4 pt-8 pb-10 md:pt-10 md:pb-14">
        <section className="mb-6 md:mb-8">
          <div className="text-center">
            <p className="text-[11px] font-semibold tracking-[0.25em] text-purple-300/80 mb-2 uppercase">
              AI Micro-Apps
            </p>

            <div className="flex items-center justify-center gap-3 mb-2">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold leading-tight">
                Tool Library
              </h1>

              <Link
                href="/"
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition"
              >
                ← Home
              </Link>
            </div>

            <p className="text-sm md:text-base text-gray-400 max-w-2xl mx-auto">
              Browse all experimental tools in Atlas. Each card opens a focused, single-page AI
              experience.
            </p>
          </div>

          {/* ✅ tighter controls spacing */}
          <div className="mt-5 space-y-3">
            <SearchBar />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3">
              <CategoryPicker />
              <SavedFilterButton isSignedIn={isSignedIn} savedCount={savedSlugs.length} />
            </div>
          </div>
        </section>

        <section className="mt-4">
          <ToolLibraryClient tools={tools} savedSlugs={savedSlugs} isSignedIn={isSignedIn} />
        </section>
      </div>
    </main>
  );
}
