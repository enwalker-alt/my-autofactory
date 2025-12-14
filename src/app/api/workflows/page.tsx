import Link from "next/link";
import AuthPill from "@/components/AuthPill";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import WorkflowClient from "./workflowClient";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  let session: any = null;
  try {
    session = await auth();
  } catch {}

  const email = session?.user?.email as string | undefined;
  let userId = (session?.user?.id as string | undefined) ?? undefined;

  if (!userId && email) {
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    userId = u?.id;
  }

  const isSignedIn = !!userId;

  const workflows = userId
    ? await prisma.workflowProfile.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          kind: true,
          name: true,
          data: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    : [];

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#050816] via-[#020617] to-black text-gray-100">
      <div className="fixed top-4 right-4 z-50">
        <AuthPill />
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-8 pb-12 md:pt-10">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.25em] text-purple-300/80 uppercase">
              Atlas Profiles
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold mt-1">Saved Workflows</h1>
            <p className="mt-2 text-sm text-gray-400 max-w-2xl">
              These are your saved personal/business workflow profiles. You can edit them here, or
              load them inside the “Recommend tools for me” wizard to autofill.
            </p>
          </div>

          <Link
            href="/tools"
            className="rounded-full px-4 py-2 text-xs font-semibold text-white bg-white/5 border border-white/10 hover:bg-white/10 hover:border-purple-400/40 transition"
          >
            ← Back to Tool Library
          </Link>
        </div>

        {!isSignedIn && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-gray-300">
            You’re not signed in. Sign in to save and manage workflows.
          </div>
        )}

        {isSignedIn && (
          <div className="mt-6">
            <WorkflowClient initialWorkflows={workflows} />
          </div>
        )}
      </div>
    </main>
  );
}
