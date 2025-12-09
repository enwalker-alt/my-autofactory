import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-bold mb-4">
        AutoFactory – Tiny AI Tools Factory
      </h1>
      <p className="text-lg text-center max-w-xl mb-8">
        This site automatically spins up small, single-page AI tools for specific
        niches. Every tool shares the same UI, but uses a different prompt
        behind the scenes.
      </p>
      <Link
        href="/tools"
        className="rounded-md border px-4 py-2 text-base font-medium hover:bg-gray-100"
      >
        View All Tools
      </Link>
    </main>
  );
}