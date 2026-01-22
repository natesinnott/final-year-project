"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

type InviteAuthCardProps = {
  token: string;
  productionName: string;
  organisationName?: string | null;
  inviterName?: string | null;
  role: string;
};

export default function InviteAuthCard({
  token,
  productionName,
  organisationName,
  inviterName,
  role,
}: InviteAuthCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [emailPassword, setEmailPassword] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

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

  const callbackURL = `/app/invite/${token}`;
  const roleLabel = role.replace(/_/g, " ");

  async function signInWithGoogle() {
    setIsLoading(true);
    setMessage(null);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL,
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function signInWithApple() {
    setIsLoading(true);
    setMessage(null);
    try {
      await authClient.signIn.social({
        provider: "apple",
        callbackURL,
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function signInWithEmail() {
    setIsLoading(true);
    setMessage(null);
    try {
      const result = await authClient.signIn.email({
        email: emailPassword.email,
        password: emailPassword.password,
        callbackURL,
      });
      const error = getAuthResultError(result);
      if (error) {
        throw new Error(error);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setIsLoading(false);
    }
  }

  async function signUpWithEmail() {
    setIsLoading(true);
    setMessage(null);
    try {
      if (emailPassword.password !== emailPassword.confirmPassword) {
        throw new Error("Passwords do not match.");
      }
      const signUpResult = await authClient.signUp.email({
        name: emailPassword.name || emailPassword.email.split("@")[0] || "User",
        email: emailPassword.email,
        password: emailPassword.password,
        callbackURL,
      });
      const signUpError = getAuthResultError(signUpResult);
      if (signUpError) {
        throw new Error(signUpError);
      }

      const signInResult = await authClient.signIn.email({
        email: emailPassword.email,
        password: emailPassword.password,
        callbackURL,
      });
      const signInError = getAuthResultError(signInResult);
      if (signInError) {
        throw new Error(signInError);
      }
    } catch (err) {
      setMessage(getEmailSignupError(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
      <p className="text-xs font-semibold tracking-wide text-amber-300">
        You are invited
      </p>
      <h1 className="mt-3 text-2xl font-semibold text-white">
        Join {productionName}
      </h1>
      <p className="mt-2 text-sm text-slate-300">
        You have been invited as a {roleLabel}.
      </p>
      <p className="mt-4 text-sm text-slate-300">
        You have been invited to {productionName}
        {organisationName ? ` at ${organisationName}` : ""} by{" "}
        {inviterName ?? "your team"}.
      </p>
      <p className="mt-2 text-sm text-slate-300">
        Create an account with Google, Apple, or your email and password to
        continue.
      </p>

      <div className="mt-6 grid gap-3">
        <button
          onClick={signInWithGoogle}
          disabled={isLoading}
          className="inline-flex w-full items-center justify-center rounded-xl bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-200 disabled:opacity-60"
        >
          {isLoading ? "Redirecting…" : "Continue with Google"}
        </button>
        <button
          onClick={signInWithApple}
          disabled={isLoading}
          className="inline-flex w-full items-center justify-center rounded-xl border border-slate-700 bg-slate-950/30 px-4 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500 disabled:opacity-60"
        >
          {isLoading ? "Redirecting…" : "Continue with Apple"}
        </button>
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
            className="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
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
            className="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
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
            className="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
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
              className="w-full rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
            />
          <button
            onClick={signUpWithEmail}
            disabled={
              isLoading ||
              emailPassword.email.length === 0 ||
              emailPassword.password.length === 0 ||
              emailPassword.confirmPassword.length === 0
            }
            className="inline-flex w-full items-center justify-center rounded-xl bg-amber-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950 hover:bg-amber-200 disabled:opacity-60"
          >
            Create account
          </button>
          <button
            type="button"
            onClick={signInWithEmail}
            disabled={
              isLoading ||
              emailPassword.email.length === 0 ||
              emailPassword.password.length === 0
            }
            className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 hover:text-white disabled:opacity-60"
          >
            Already have an account? Sign in
          </button>
        </div>
      </div>

      {message ? (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-200">
          {message}
        </div>
      ) : null}
    </div>
  );
}
