"use client";

import { useMemo, useState } from "react";

const DEFAULT_ROLE = "CAST";

type ProductionInviteCardProps = {
  productionId: string;
  productionName: string;
  productionRoles: string[];
};

export default function ProductionInviteCard({
  productionId,
  productionName,
  productionRoles,
}: ProductionInviteCardProps) {
  const [role, setRole] = useState(DEFAULT_ROLE);
  const [expiresAt, setExpiresAt] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const roleOptions = useMemo(() => {
    return productionRoles.map((entry) => ({
      value: entry,
      label: entry.replace(/_/g, " "),
    }));
  }, [productionRoles]);

  async function handleGenerate() {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/productions/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productionId,
          role,
          expiresAt: expiresAt || null,
          maxUses: maxUses ? Number(maxUses) : null,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to generate invite.");
      }

      const url = new URL(`/app/invite/${payload.token}`, window.location.origin);
      setInviteLink(url.toString());
      setMessage(`Share this link to invite ${productionName} members.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopy() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setMessage("Invite link copied to clipboard.");
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Invite link</h2>
          <p className="mt-2 text-sm text-slate-300">
            Generate a shareable link for cast and crew. You can adjust role and
            expiry settings per invite.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Default role
          </label>
          <select
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Expiry date
            </label>
            <input
              type="date"
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Max uses
            </label>
            <input
              type="number"
              min={1}
              className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
              placeholder="Unlimited"
              value={maxUses}
              onChange={(event) => setMaxUses(event.target.value)}
            />
          </div>
        </div>

        {inviteLink ? (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-slate-200">
            <div className="font-semibold text-white">Invite link</div>
            <div className="mt-2 break-all text-xs text-slate-300">
              {inviteLink}
            </div>
            <button
              type="button"
              className="mt-3 rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
              onClick={handleCopy}
            >
              Copy link
            </button>
          </div>
        ) : null}

        {message ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
            {message}
          </div>
        ) : null}

        <button
          type="button"
          className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-70"
          onClick={handleGenerate}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Generating…" : "Generate invite"}
        </button>
      </div>
    </div>
  );
}
