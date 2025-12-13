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
      } as ToolMeta;
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  let tools = getToolsFromConfigs();

  // ✅ pull ratings from DB for these slugs
  try {
    const slugs = tools.map((t) => t.slug);
    const rows = await prisma.tool.findMany({
      where: { slug: { in: slugs } },
      select: {
        slug: true,
      },
    });

    const map = new Map(rows.map((r) => [r.slug, r]));
    tools = tools.map((t) => {
      const r = map.get(t.slug);
      return {
        ...t,
      };
    });
  } catch {
    // ignore — still render
  }

  const sp = await searchParams;
  const savedOn = sp?.saved === "1";

  let userId: string | undefined = undefined;
  let isSignedIn = false;
  let savedSlugs: string[] = [];

  let session: any = null;
  try {
    session = await auth();
  } catch {
    session = null;
  }

  const sessionUser = session?.user;
  const email = (sessionUser?.email as string | undefined) ?? undefined;

  userId = (sessionUser?.id as string | undefined) ?? undefined;

  if (!userId && email) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      userId = dbUser?.id;
    } catch {
      userId = undefined;
    }
  }

  isSignedIn = !!userId;

  if (userId) {
    try {
      const saved = await prisma.savedTool.findMany({
        where: { userId },
        select: { tool: { select: { slug: true } } },
        orderBy: { createdAt: "desc" },
      });

      savedSlugs = saved
        .map((s) => s.tool?.slug)
        .filter((slug): slug is string => !!slug);
    } catch {
      savedSlugs = [];
    }
  }

  if (savedOn) {
    if (!isSignedIn) {
      tools = [];
    } else {
      const set = new Set(savedSlugs);
      tools = tools.filter((t) => set.has(t.slug));
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#050816] via-[#020617] to-black text-gray-100">
      <div className="max-w-5xl mx-auto px-4 py-12 md:py-16">
        <header className="mb-10 flex items-center justify-end">
          <AuthPill />
        </header>

        <section className="mb-10 md:mb-12">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-[0.25em] text-purple-300/80 mb-3 uppercase">
              AI Micro-Apps
            </p>

            <div className="flex items-center justify-center gap-3 mb-3">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold">
                Tool Library
              </h1>

              <Link
                href="/"
                className="
                  px-3 py-1.5
                  text-xs font-medium
                  rounded-lg
                  bg-white/5
                  border border-white/10
                  backdrop-blur
                  hover:bg-white/10
                  transition
                  duration-200
                  whitespace-nowrap
                "
              >
                ← Home
              </Link>
            </div>

            <p className="text-sm md:text-base text-gray-400 max-w-2xl mx-auto">
              Browse all experimental tools in Atlas. Each card opens a focused,
              single-page AI experience.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            <SearchBar />

            <div className="flex justify-center">
              <div className="flex items-center gap-3">
                <CategoryPicker />
                <SavedFilterButton
                  isSignedIn={isSignedIn}
                  savedCount={savedSlugs.length}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <ToolLibraryClient
            tools={tools}
            savedSlugs={savedSlugs}
            isSignedIn={isSignedIn}
          />
        </section>
      </div>
    </main>
  );
}
