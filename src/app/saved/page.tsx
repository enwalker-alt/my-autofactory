import { prisma } from "@/lib/prisma";
import Link from "next/link";

type Session = { user?: { id?: string } } | null;

// Minimal local auth stub — replace with your real auth (NextAuth/Clerk/etc.)
async function auth(): Promise<Session> {
  // Return null to indicate not signed in; replace with actual session retrieval.
  return null;
}

export default async function SavedPage() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <main className="min-h-screen bg-[#020617] text-slate-100 p-6">
        <p className="text-sm text-slate-300">Please sign in to view saved tools.</p>
      </main>
    );
  }

  const saved = await prisma.savedTool.findMany({
    where: { userId: session.user.id },
    include: { tool: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-[#020617] text-slate-100 p-6">
      <h1 className="text-xl font-semibold mb-4">Saved tools</h1>

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
                  <p className="text-xs text-slate-400 truncate">{s.tool.description}</p>
                </div>
                <div className="text-xs text-slate-400">
                  ⭐ {s.tool.ratingAvg.toFixed(1)} ({s.tool.ratingCount})
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
