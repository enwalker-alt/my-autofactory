import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const session = await auth();
  const user = session?.user as any | undefined;

  const email = user?.email as string | undefined;
  let userId = (user?.id as string | undefined) ?? undefined;

  // ✅ fallback: resolve userId via email (reliable)
  if (!userId && email) {
    const dbUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    userId = dbUser?.id;
  }

  if (!userId) {
    return (
      <main className="min-h-screen bg-[#020617] text-slate-100 p-6">
        <p className="text-sm text-slate-300">
          Please sign in to view saved tools.
        </p>
      </main>
    );
  }

  const saved = await prisma.savedTool.findMany({
    where: { userId },
    include: { tool: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-[#020617] text-slate-100 p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-xl font-semibold">Saved tools</h1>
        <Link
          href="/tools"
          className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-100 hover:bg-white/10 transition"
        >
          ← Back to tools
        </Link>
      </div>

      {saved.length === 0 ? (
        <p className="text-sm text-slate-400">No saved tools yet.</p>
      ) : (
        <div className="grid gap-3">
          {saved.map((s) => (
            <Link
              key={s.id}
              href={`/tools/${s.tool.slug}`}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{s.tool.title}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {s.tool.description}
                  </p>
                </div>
                <div className="text-xs text-slate-400">
                  ⭐ {Number(s.tool.ratingAvg ?? 0).toFixed(1)} (
                  {Number(s.tool.ratingCount ?? 0)})
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
