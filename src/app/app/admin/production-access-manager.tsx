"use client";

import { useMemo, useState } from "react";

type ProductionAccess = {
  productionId: string;
  productionName: string;
  role: string;
};

type UserAccessRow = {
  userId: string;
  name: string;
  email: string;
  productions: ProductionAccess[];
};

type ProductionAccessManagerProps = {
  productionRoles: string[];
  users: UserAccessRow[];
};

export default function ProductionAccessManager({
  productionRoles,
  users,
}: ProductionAccessManagerProps) {
  const [rows, setRows] = useState(users);
  const [isBusy, setIsBusy] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);

  const userIds = useMemo(() => new Set(rows.map((row) => row.userId)), [rows]);

  async function updateRole(
    userId: string,
    productionId: string,
    role: string
  ) {
    const key = `${userId}:${productionId}`;
    setIsBusy((prev) => ({ ...prev, [key]: true }));
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
        prev.map((row) =>
          row.userId === userId
            ? {
                ...row,
                productions: row.productions.map((entry) =>
                  entry.productionId === productionId
                    ? { ...entry, role }
                    : entry
                ),
              }
            : row
        )
      );
      setMessage("Member role updated.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsBusy((prev) => ({ ...prev, [key]: false }));
    }
  }

  async function removeMember(userId: string, productionId: string) {
    const key = `${userId}:${productionId}`;
    setIsBusy((prev) => ({ ...prev, [key]: true }));
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
      setRows((prev) =>
        prev.map((row) =>
          row.userId === userId
            ? {
                ...row,
                productions: row.productions.filter(
                  (entry) => entry.productionId !== productionId
                ),
              }
            : row
        )
      );
      setMessage("Member removed from production.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsBusy((prev) => ({ ...prev, [key]: false }));
    }
  }

  if (userIds.size === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
        No production members yet.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Production access
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">
          Manage production roles
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Adjust roles or revoke access across productions.
        </p>
      </header>

      <div className="mt-4 grid gap-4">
        {rows.map((user) => (
          <div
            key={user.userId}
            className="rounded-xl border border-slate-800 bg-slate-950/30 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">
                  {user.name}
                </div>
                <div className="text-xs text-slate-400">{user.email}</div>
              </div>
              <div className="text-xs text-slate-400">
                {user.productions.length} production
                {user.productions.length === 1 ? "" : "s"}
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border border-slate-800">
              <div className="grid grid-cols-[2fr_1fr_1fr] gap-3 border-b border-slate-800 bg-slate-950/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                <div>Production</div>
                <div>Role</div>
                <div>Actions</div>
              </div>
              {user.productions.length === 0 ? (
                <div className="px-3 py-3 text-sm text-slate-400">
                  No production access yet.
                </div>
              ) : (
                user.productions.map((entry) => {
                  const key = `${user.userId}:${entry.productionId}`;
                  return (
                    <div
                      key={entry.productionId}
                      className="grid grid-cols-[2fr_1fr_1fr] gap-3 border-b border-slate-800 px-3 py-2 text-sm text-slate-200"
                    >
                      <div className="font-medium text-white">
                        {entry.productionName}
                      </div>
                      <div>
                        <select
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-300"
                          value={entry.role}
                          onChange={(event) =>
                            setRows((prev) =>
                              prev.map((row) =>
                                row.userId === user.userId
                                  ? {
                                      ...row,
                                      productions: row.productions.map((item) =>
                                        item.productionId === entry.productionId
                                          ? {
                                              ...item,
                                              role: event.target.value,
                                            }
                                          : item
                                      ),
                                    }
                                  : row
                              )
                            )
                          }
                          disabled={isBusy[key]}
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
                          onClick={() =>
                            updateRole(
                              user.userId,
                              entry.productionId,
                              entry.role
                            )
                          }
                          disabled={isBusy[key]}
                        >
                          Update
                        </button>
                        <button
                          className="rounded-lg border border-rose-500/60 px-3 py-1 text-xs text-rose-200 hover:border-rose-400 disabled:opacity-60"
                          onClick={() =>
                            removeMember(user.userId, entry.productionId)
                          }
                          disabled={isBusy[key]}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
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
