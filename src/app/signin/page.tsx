import { signIn } from "next-auth/react";

export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <button
        onClick={() => signIn("google", { callbackUrl: "/tools" })}
        className="px-6 py-3 rounded-xl border"
      >
        Sign in with Google
      </button>
    </main>
  );
}
