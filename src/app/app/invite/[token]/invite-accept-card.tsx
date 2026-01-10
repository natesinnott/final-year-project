"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type InviteAcceptCardProps = {
  token: string;
  productionName: string;
  role: string;
};

export default function InviteAcceptCard({
  token,
  productionName,
  role,
}: InviteAcceptCardProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleAccept() {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/productions/invites/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to accept invite.");
      }

      router.push(`/app?productionId=${payload.productionId}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-white">
        Join {productionName}
      </h1>
      <p className="mt-2 text-sm text-slate-300">
        You have been invited to join this production as a {role.replace(/_/g, " ")}.
      </p>

      {message ? (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
          {message}
        </div>
      ) : null}

      <button
        type="button"
        className="mt-4 rounded-xl bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-70"
        onClick={handleAccept}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Joining…" : "Accept invite"}
      </button>
    </div>
  );
}
