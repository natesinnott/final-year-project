"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";

export default function LoginPage() {
  useEffect(() => {
    document.title = "StageSuite | Sign in";
  }, []);

  const [isLoading, setIsLoading] = useState(false);
  const [ssoEmail, setSsoEmail] = useState("");
  const [ssoError, setSsoError] = useState<string | null>(null);
  const [emailPassword, setEmailPassword] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [emailPasswordError, setEmailPasswordError] = useState<string | null>(
    null
  );

  function getAuthResultError(result: unknown) {
    if (!result || typeof result !== "object") return null;
    if (!("error" in result)) return null;
    const error = (result as { error?: unknown }).error;
    if (!error) return null;
    if (typeof error === "string") return error;
    if (typeof error === "object") {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
    return "Unable to authenticate.";
  }

  function getEmailSignupError(err: unknown) {
    const message = err instanceof Error ? err.message : "";
    const normalized = message.toLowerCase();
    if (
      normalized.includes("already exists") ||
      normalized.includes("user exists") ||
      normalized.includes("email exists") ||
      normalized.includes("credential account not found") ||
      normalized.includes("duplicate") ||
      normalized.includes("unique constraint")
    ) {
      return "An account with this email already exists. Please sign in instead.";
    }
    return message || "Unable to create account.";
  }

  async function signInWithGoogle() {
    setIsLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/app",
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
        callbackURL: "/app",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function signInWithEntra() {
    setIsLoading(true);
    try {
      await authClient.signIn.social({
        provider: "microsoft-entra-id",
        callbackURL: "/app",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function signInWithOkta() {
    setIsLoading(true);
    try {
      await authClient.signIn.social({
        provider: "okta",
        callbackURL: "/app",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function signInWithGoogleWorkspace() {
    setIsLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google-workspace",
        callbackURL: "/app",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSsoRouting() {
    setIsLoading(true);
    setSsoError(null);
    try {
      // Resolve the org-specific provider from the user's email domain.
      const response = await fetch("/api/sso/resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: ssoEmail }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to resolve SSO provider.");
      }

      if (!payload.providerId) {
        setSsoError(
          "No organisation SSO configuration found. Use another sign-in method."
        );
        return;
      }

      await authClient.signIn.oauth2({
        providerId: payload.providerId,
        callbackURL: "/app",
      });
    } catch (err) {
      setSsoError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  async function signInWithEmail() {
    setIsLoading(true);
    setEmailPasswordError(null);
    try {
      // Email/password sign-in for non-SSO users.
      const result = await authClient.signIn.email({
        email: emailPassword.email,
        password: emailPassword.password,
        callbackURL: "/app",
      });
      const error = getAuthResultError(result);
      if (error) {
        throw new Error(error);
      }
    } catch (err) {
      setEmailPasswordError(
        err instanceof Error ? err.message : "Unable to sign in."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function signUpWithEmail() {
    setIsLoading(true);
    setEmailPasswordError(null);
    try {
      if (emailPassword.password !== emailPassword.confirmPassword) {
        throw new Error("Passwords do not match.");
      }
      // Create a local account with email/password for the demo.
      const signUpResult = await authClient.signUp.email({
        name: emailPassword.name || emailPassword.email.split("@")[0] || "User",
        email: emailPassword.email,
        password: emailPassword.password,
        callbackURL: "/app",
      });
      const signUpError = getAuthResultError(signUpResult);
      if (signUpError) {
        throw new Error(signUpError);
      }

      // Ensure the user is signed in after account creation.
      const signInResult = await authClient.signIn.email({
        email: emailPassword.email,
        password: emailPassword.password,
        callbackURL: "/app",
      });
      const signInError = getAuthResultError(signInResult);
      if (signInError) {
        throw new Error(signInError);
      }
    } catch (err) {
      setEmailPasswordError(getEmailSignupError(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="relative min-h-dvh bg-slate-950 text-slate-100 font-sans antialiased">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 right-0 h-130 w-130 rounded-full bg-linear-to-br from-amber-400/25 via-orange-500/10 to-purple-500/10 blur-3xl" />
        <div className="absolute left-0 top-1/3 h-140 w-140 rounded-full bg-linear-to-br from-sky-500/15 via-emerald-500/5 to-transparent blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_55%)]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col justify-center px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid items-stretch gap-8 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-800/70 bg-slate-900/40 p-6 backdrop-blur sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm font-semibold tracking-tight text-white">
                StageSuite
              </div>
              <Link
                className="text-xs font-medium text-slate-300 hover:text-white"
                href="/"
              >
                Back to home
              </Link>
            </div>

            <div className="mt-10">
              <p className="text-xs font-semibold tracking-wide text-amber-300">
                Sign in
              </p>
              <h1 className="mt-4 text-3xl font-semibold leading-[1.05] tracking-tight text-white sm:text-4xl">
                Welcome back.
              </h1>
              <p className="mt-4 max-w-prose text-sm leading-relaxed text-slate-300 sm:text-base">
                Keep schedules, announcements, attendance, and files in one place—so rehearsals run on time, not on chaos.
              </p>

              <dl className="mt-10 grid gap-4">
                <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
                  <dt className="text-sm font-semibold text-white">
                    Set up your theatre in minutes
                  </dt>
                  <dd className="mt-1 text-sm text-slate-300">
                    Create your organisation, add your first production, and invite your team.
                  </dd>
                </div>
                <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
                  <dt className="text-sm font-semibold text-white">
                    Role-based access, by default
                  </dt>
                  <dd className="mt-1 text-sm text-slate-300">
                    Directors, stage managers, cast, and crew each see what they need.
                  </dd>
                </div>
                <div className="rounded-2xl border border-slate-800/70 bg-slate-950/50 p-4">
                  <dt className="text-sm font-semibold text-white">
                    Start scheduling immediately
                  </dt>
                  <dd className="mt-1 text-sm text-slate-300">
                    Capture availability, track attendance, and share rehearsal plans.
                  </dd>
                </div>
              </dl>

              <p className="mt-8 text-xs text-slate-400">
                New here? No worries—you’ll be redirected to onboarding if you don’t belong to an organisation yet.
              </p>
            </div>
          </section>

          <aside className="flex items-center">
            <div className="w-full">
              <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-800/70 bg-slate-900/50 p-6 shadow-2xl backdrop-blur sm:p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-amber-300">
                      Secure sign-in
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                      Sign in to StageSuite
                    </h2>
                    <p className="mt-2 text-sm text-slate-300">
                      Choose a provider to continue.
                    </p>
                  </div>
                </div>

                <div className="mt-8 grid gap-3">
                  <button
                    onClick={signInWithGoogle}
                    disabled={isLoading}
                    className="inline-flex w-full items-center justify-center rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm hover:bg-amber-200 disabled:opacity-60"
                  >
                    {isLoading ? "Redirecting…" : "Continue with Google"}
                  </button>
                  <button
                    onClick={signInWithApple}
                    disabled={isLoading}
                    className="inline-flex w-full items-center justify-center rounded-full border border-slate-700 bg-slate-950/30 px-5 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500 disabled:opacity-60"
                  >
                    {isLoading ? "Redirecting…" : "Continue with Apple"}
                  </button>
                </div>

                <div className="mt-6 border-t border-slate-800/70 pt-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    SSO options
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Use your organisation identity provider.
                  </p>
                  <div className="mt-4 grid gap-3">
                    <button
                      onClick={signInWithEntra}
                      disabled={isLoading}
                      className="inline-flex w-full items-center justify-center rounded-full border border-slate-700 bg-slate-950/30 px-5 py-2 text-xs font-semibold text-slate-100 hover:border-slate-500 disabled:opacity-60"
                    >
                      Continue with Microsoft Entra
                    </button>
                    <button
                      onClick={signInWithOkta}
                      disabled={isLoading}
                      className="inline-flex w-full items-center justify-center rounded-full border border-slate-700 bg-slate-950/30 px-5 py-2 text-xs font-semibold text-slate-100 hover:border-slate-500 disabled:opacity-60"
                    >
                      Continue with Okta
                    </button>
                    <button
                      onClick={signInWithGoogleWorkspace}
                      disabled={isLoading}
                      className="inline-flex w-full items-center justify-center rounded-full border border-slate-700 bg-slate-950/30 px-5 py-2 text-xs font-semibold text-slate-100 hover:border-slate-500 disabled:opacity-60"
                    >
                      Continue with Google Workspace
                    </button>
                  </div>
                </div>

                <div className="mt-6 border-t border-slate-800/70 pt-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Organisation SSO
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Enter your work email and we will route you to the right
                    identity provider.
                  </p>
                  <div className="mt-4 grid gap-3">
                    <input
                      type="email"
                      placeholder="you@organisation.org"
                      value={ssoEmail}
                      onChange={(event) => setSsoEmail(event.target.value)}
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
                    />
                    <button
                      onClick={handleSsoRouting}
                      disabled={isLoading || ssoEmail.length === 0}
                      className="inline-flex w-full items-center justify-center rounded-full bg-slate-100 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950 hover:bg-white disabled:opacity-60"
                    >
                      {isLoading ? "Checking…" : "Continue with SSO"}
                    </button>
                  </div>
                  {ssoError ? (
                    <div className="mt-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-200">
                      {ssoError}
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 border-t border-slate-800/70 pt-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Email and password
                  </p>
                  <div className="mt-4 grid gap-3">
                    <input
                      type="text"
                      placeholder="Full name"
                      value={emailPassword.name}
                      onChange={(event) =>
                        setEmailPassword((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
                    />
                    <input
                      type="email"
                      placeholder="Email address"
                      value={emailPassword.email}
                      onChange={(event) =>
                        setEmailPassword((prev) => ({
                          ...prev,
                          email: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
                    />
                  <input
                    type="password"
                    placeholder="Password"
                    value={emailPassword.password}
                    onChange={(event) =>
                      setEmailPassword((prev) => ({
                        ...prev,
                        password: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
                  />
                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={emailPassword.confirmPassword}
                    onChange={(event) =>
                      setEmailPassword((prev) => ({
                        ...prev,
                        confirmPassword: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      onClick={signInWithEmail}
                      disabled={
                        isLoading ||
                        emailPassword.email.length === 0 ||
                        emailPassword.password.length === 0
                        }
                        className="inline-flex w-full items-center justify-center rounded-full border border-slate-700 bg-slate-950/30 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100 hover:border-slate-500 disabled:opacity-60"
                      >
                        Sign in
                      </button>
                    <button
                      onClick={signUpWithEmail}
                      disabled={
                        isLoading ||
                        emailPassword.email.length === 0 ||
                        emailPassword.password.length === 0 ||
                        emailPassword.confirmPassword.length === 0
                      }
                      className="inline-flex w-full items-center justify-center rounded-full bg-amber-300 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950 hover:bg-amber-200 disabled:opacity-60"
                    >
                      Create account
                    </button>
                    </div>
                  </div>
                  {emailPasswordError ? (
                    <div className="mt-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-200">
                      {emailPasswordError}
                    </div>
                  ) : null}
                </div>

                <p className="mt-6 text-xs text-slate-500">
                  By continuing, you agree to keep rehearsal drama onstage.
                </p>
              </div>

              <div className="mx-auto mt-6 w-full max-w-md text-center text-xs text-slate-500">
                <span className="text-slate-400">StageSuite</span> · Final Year Project
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
