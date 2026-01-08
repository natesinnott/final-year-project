"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);

  async function signInWithGoogle() {
    setIsLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/", // land on the protected Under Construction page
      });
    } finally {
      setIsLoading(false);
    }
  }

    async function signInWithApple() {
    setIsLoading(true);
    try {
      await authClient.signIn.social({
        provider: "apple",
        callbackURL: "/", // land on the protected Under Construction page
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You’ll need to sign in to access the prototype.
        </p>

        <button
          onClick={signInWithGoogle}
          disabled={isLoading}
          className="mt-6 w-full rounded-xl bg-black px-4 py-3 text-white disabled:opacity-60"
        >
          {isLoading ? "Redirecting…" : "Sign in with Google"}
        </button>
                <button
          onClick={signInWithApple}
          disabled={isLoading}
          className="mt-6 w-full rounded-xl bg-black px-4 py-3 text-white disabled:opacity-60"
        >
          {isLoading ? "Redirecting…" : "Sign in with Apple"}
        </button>

        <p className="mt-4 text-xs text-muted-foreground">
          If Google blocks you, add your account as a Test User in the OAuth
          consent screen.
        </p>
      </div>
    </main>
  );
}