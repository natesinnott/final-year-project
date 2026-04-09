"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { OfficialSocialAuthButtons } from "@/components/auth/official-social-auth-buttons";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [ssoEmail, setSsoEmail] = useState("");
  const [ssoError, setSsoError] = useState<string | null>(null);
  const [socialAuthError, setSocialAuthError] = useState<string | null>(null);
  const [emailPassword, setEmailPassword] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [emailAuthMode, setEmailAuthMode] = useState<"signIn" | "signUp">(
    "signIn"
  );
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

  async function signInWithApple() {
    setIsLoading(true);
    setSocialAuthError(null);
    try {
      await authClient.signIn.social({
        provider: "apple",
        callbackURL: "/app",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function signInWithGoogleCredential(idToken: string) {
    setIsLoading(true);
    setSocialAuthError(null);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/app",
        idToken: {
          token: idToken,
        },
      });
      const error = getAuthResultError(result);
      if (error) {
        throw new Error(error);
      }

      window.location.assign("/app");
    } catch (err) {
      setSocialAuthError(
        err instanceof Error ? err.message : "Unable to sign in with Google."
      );
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
      const response = await fetch("/api/sso/resolve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: ssoEmail.trim() }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to resolve SSO provider.");
      }

      if (!payload.providerId) {
        setSsoError(
          "No organisation SSO configuration was found for that email. Use another sign-in method."
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
      const result = await authClient.signIn.email({
        email: emailPassword.email.trim(),
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
      const cleanedEmail = emailPassword.email.trim();
      const signUpResult = await authClient.signUp.email({
        name: emailPassword.name || cleanedEmail.split("@")[0] || "User",
        email: cleanedEmail,
        password: emailPassword.password,
        callbackURL: "/app",
      });
      const signUpError = getAuthResultError(signUpResult);
      if (signUpError) {
        throw new Error(signUpError);
      }

      const signInResult = await authClient.signIn.email({
        email: cleanedEmail,
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

  async function handleSsoSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading || ssoEmail.trim().length === 0) {
      return;
    }
    await handleSsoRouting();
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (emailAuthMode === "signIn") {
      if (
        isLoading ||
        emailPassword.email.trim().length === 0 ||
        emailPassword.password.length === 0
      ) {
        return;
      }
      await signInWithEmail();
      return;
    }

    if (
      isLoading ||
      emailPassword.email.trim().length === 0 ||
      emailPassword.password.length === 0 ||
      emailPassword.confirmPassword.length === 0
    ) {
      return;
    }

    await signUpWithEmail();
  }

  const fieldClassName =
    "w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-amber-300/70 focus:ring-2 focus:ring-amber-300/20";
  const secondaryButtonClassName =
    "inline-flex w-full items-center justify-center rounded-2xl border border-slate-700 bg-slate-950/40 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:text-white disabled:opacity-60";
  const secondaryProviders = [
    {
      label: "Microsoft Entra",
      onClick: signInWithEntra,
    },
    {
      label: "Okta",
      onClick: signInWithOkta,
    },
    {
      label: "Google Workspace",
      onClick: signInWithGoogleWorkspace,
    },
  ];

  const isEmailDisabled =
    isLoading ||
    emailPassword.email.trim().length === 0 ||
    emailPassword.password.length === 0 ||
    (emailAuthMode === "signUp" &&
      emailPassword.confirmPassword.length === 0);

  const isSsoDisabled = isLoading || ssoEmail.trim().length === 0;

  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-6 text-slate-100 font-sans antialiased sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-2xl items-center">
        <section className="w-full rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm font-semibold tracking-tight text-white">
              StageSuite
            </div>
            <Link
              className="text-xs font-medium text-slate-300 transition hover:text-white"
              href="/"
            >
              Back to home
            </Link>
          </div>

          <div className="mt-8">
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Sign in
            </h1>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <OfficialSocialAuthButtons
              googleClientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}
              isLoading={isLoading}
              onGoogleCredential={signInWithGoogleCredential}
              onAppleClick={signInWithApple}
            />
          </div>
          {socialAuthError ? (
            <div className="mt-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {socialAuthError}
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
            <div className="grid w-full gap-2 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-1 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setEmailAuthMode("signIn");
                  setEmailPasswordError(null);
                }}
                className={`w-full rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
  emailAuthMode === "signIn"
    ? "bg-slate-800 text-white shadow-sm"
    : "text-slate-300 hover:bg-slate-900/60 hover:text-white"
}`}
                disabled={isLoading}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmailAuthMode("signUp");
                  setEmailPasswordError(null);
                }}
                className={`w-full rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
  emailAuthMode === "signUp"
    ? "bg-slate-800 text-white shadow-sm"
    : "text-slate-300 hover:bg-slate-900/60 hover:text-white"
}`}
                disabled={isLoading}
              >
                Create account
              </button>
            </div>

            <form onSubmit={handleEmailSubmit} className="mt-4 grid gap-3">
              {emailAuthMode === "signUp" ? (
                <label className="grid gap-2 text-sm text-slate-200">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Full name
                  </span>
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
                    className={fieldClassName}
                  />
                </label>
              ) : null}

              <label className="grid gap-2 text-sm text-slate-200">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Email address
                </span>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={emailPassword.email}
                  onChange={(event) =>
                    setEmailPassword((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                  className={fieldClassName}
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-200">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Password
                </span>
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
                  className={fieldClassName}
                />
              </label>

              {emailAuthMode === "signUp" ? (
                <label className="grid gap-2 text-sm text-slate-200">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Confirm password
                  </span>
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
                    className={fieldClassName}
                  />
                </label>
              ) : null}

              <button
                type="submit"
                disabled={isEmailDisabled}
                className={`inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                  isEmailDisabled
                    ? "bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed"
                    : "bg-amber-300 text-slate-950 hover:bg-amber-200"
                }`}
              >
                {emailAuthMode === "signIn"
                  ? isLoading
                    ? "Signing in..."
                    : "Sign in"
                  : isLoading
                    ? "Creating account..."
                    : "Create account"}
              </button>
            </form>

            {emailPasswordError ? (
              <div className="mt-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {emailPasswordError}
              </div>
            ) : null}
          </div>

          <form
            onSubmit={handleSsoSubmit}
            className="mt-4 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Organisation SSO
            </p>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm text-slate-200">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Work email
                </span>
                <input
                  type="email"
                  placeholder="you@organisation.org"
                  value={ssoEmail}
                  onChange={(event) => setSsoEmail(event.target.value)}
                  className={fieldClassName}
                />
              </label>
              <button
                type="submit"
                disabled={isSsoDisabled}
                className={`inline-flex w-full items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                  isSsoDisabled
                    ? "bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed"
                    : "bg-amber-300 text-slate-950 hover:bg-amber-200"
                }`}
              >
                {isLoading ? "Checking..." : "Sign in with SSO"}
              </button>
            </div>

            {ssoError ? (
              <div className="mt-3 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {ssoError}
              </div>
            ) : null}
          </form>

          <div className="mt-4 rounded-2xl border border-slate-800/70 bg-slate-950/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Other
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {secondaryProviders.map((provider) => (
                <button
                  key={provider.label}
                  type="button"
                  onClick={provider.onClick}
                  disabled={isLoading}
                  className={secondaryButtonClassName}
                >
                  {provider.label}
                </button>
              ))}
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            If you do not belong to an organisation yet, you will be taken through
            onboarding after sign-in.
          </p>
        </section>
      </div>
    </main>
  );
}
