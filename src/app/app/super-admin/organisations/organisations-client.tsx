"use client";

import { useState } from "react";

type OrganisationRow = {
  id: string;
  name: string;
  primaryLocation: string | null;
  contactEmail: string | null;
  createdAt: string;
  _count: {
    memberships: number;
    productions: number;
    announcements: number;
    fileAssets: number;
  };
};

type OrganisationsClientProps = {
  organisations: OrganisationRow[];
};

export default function OrganisationsClient({
  organisations: initialOrganisations,
}: OrganisationsClientProps) {
  const [organisations, setOrganisations] =
    useState<OrganisationRow[]>(initialOrganisations);
  const [isBusy, setIsBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleDelete(organisation: OrganisationRow) {
    const confirmed = window.confirm(
      `Delete "${organisation.name}" and all associated data? This cannot be undone.`
    );
    if (!confirmed) return;

    setIsBusy(organisation.id);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/organisations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organisationId: organisation.id }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to delete organisation.");
      }
      setOrganisations((prev) =>
        prev.filter((entry) => entry.id !== organisation.id)
      );
      setMessage(`Deleted ${organisation.name}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsBusy(null);
    }
  }

  if (organisations.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
        No organisations found.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Organisations
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">
          Manage organisations
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Delete organisations and cascade all related data.
        </p>
      </header>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 border-b border-slate-800 bg-slate-950/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          <div>Organisation</div>
          <div>Members</div>
          <div>Productions</div>
          <div>Actions</div>
        </div>
        {organisations.map((org) => (
          <div
            key={org.id}
            className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 border-b border-slate-800 px-4 py-3 text-sm text-slate-200"
          >
            <div>
              <div className="font-medium text-white">{org.name}</div>
              <div className="text-xs text-slate-400">
                {org.primaryLocation ?? "No location"} ·{" "}
                {org.contactEmail ?? "No contact email"}
              </div>
              <div className="text-xs text-slate-500">{org.id}</div>
            </div>
            <div className="text-sm text-slate-300">{org._count.memberships}</div>
            <div className="text-sm text-slate-300">{org._count.productions}</div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-lg border border-rose-500/60 px-3 py-1 text-xs text-rose-200 hover:border-rose-400 disabled:opacity-60"
                onClick={() => handleDelete(org)}
                disabled={isBusy === org.id}
              >
                {isBusy === org.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {message ? (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
          {message}
        </div>
      ) : null}
    </section>
  );
}
