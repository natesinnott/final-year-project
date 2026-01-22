"use client";

import { useMemo, useState } from "react";

type ProductionMemberRow = {
  userId: string;
  name: string;
  email: string;
  role: string;
};

type ProductionMembersCardProps = {
  productionId: string;
  members: ProductionMemberRow[];
  productionRoles: string[];
};

export default function ProductionMembersCard({
  productionId,
  members,
  productionRoles,
}: ProductionMembersCardProps) {
  const [rows, setRows] = useState(members);
  const [isBusy, setIsBusy] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);

  const memberIds = useMemo(
    () => new Set(rows.map((row) => row.userId)),
    [rows]
  );

  async function updateRole(userId: string, role: string) {
    setIsBusy((prev) => ({ ...prev, [userId]: true }));
    setMessage(null);
    try {
      const response = await fetch("/api/productions/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionId, userId, role }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to update member.");
      }
      setRows((prev) =>
        prev.map((row) => (row.userId === userId ? { ...row, role } : row))
      );
      setMessage("Member role updated.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsBusy((prev) => ({ ...prev, [userId]: false }));
    }
  }

  async function removeMember(userId: string) {
    setIsBusy((prev) => ({ ...prev, [userId]: true }));
    setMessage(null);
    try {
      const response = await fetch("/api/productions/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionId, userId }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to remove member.");
      }
      setRows((prev) => prev.filter((row) => row.userId !== userId));
      setMessage("Member removed.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsBusy((prev) => ({ ...prev, [userId]: false }));
    }
  }

  if (memberIds.size === 0) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-sm text-slate-300 shadow-sm">
        No members have joined this production yet.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Production members
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">
            Manage member access
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Update roles or remove access for this production.
          </p>
        </div>
      </header>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
        <div className="grid grid-cols-[2fr_1fr_1fr] gap-3 border-b border-slate-800 bg-slate-950/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          <div>Member</div>
          <div>Role</div>
          <div>Actions</div>
        </div>
        {rows.map((member) => (
          <div
            key={member.userId}
            className="grid grid-cols-[2fr_1fr_1fr] gap-3 border-b border-slate-800 px-4 py-3 text-sm text-slate-200"
          >
            <div>
              <div className="font-medium text-white">{member.name}</div>
              <div className="text-xs text-slate-400">{member.email}</div>
            </div>
            <div>
              <select
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-300"
                value={member.role}
                onChange={(event) =>
                  setRows((prev) =>
                    prev.map((row) =>
                      row.userId === member.userId
                        ? { ...row, role: event.target.value }
                        : row
                    )
                  )
                }
                disabled={isBusy[member.userId]}
              >
                {productionRoles.map((role) => (
                  <option key={role} value={role}>
                    {role.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500 disabled:opacity-60"
                onClick={() => updateRole(member.userId, member.role)}
                disabled={isBusy[member.userId]}
              >
                Update
              </button>
              <button
                className="rounded-lg border border-rose-500/60 px-3 py-1 text-xs text-rose-200 hover:border-rose-400 disabled:opacity-60"
                onClick={() => removeMember(member.userId)}
                disabled={isBusy[member.userId]}
              >
                Remove
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
