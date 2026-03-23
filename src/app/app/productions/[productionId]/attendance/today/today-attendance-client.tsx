"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useBrowserDateTime } from "@/lib/useBrowserDateTime";

type RosterEntry = {
  userId: string;
  name: string;
  email: string;
  role: string;
  status: "PRESENT" | "REPORTED_ABSENT" | "NO_SHOW";
  note: string | null;
  hasExplicitRow: boolean;
};

type TodayBlock = {
  id: string;
  title: string;
  start: string;
  end: string;
  calledUserCount: number;
  roster: RosterEntry[];
};

type TodayAttendanceClientProps = {
  productionId: string;
  productionTimeZone: string;
  blocks: TodayBlock[];
};

function statusBadge(status: RosterEntry["status"]) {
  if (status === "REPORTED_ABSENT") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  }

  if (status === "NO_SHOW") {
    return "border-rose-500/40 bg-rose-500/10 text-rose-100";
  }

  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const candidate = payload as { error?: unknown };

    if (typeof candidate.error === "string" && candidate.error.length > 0) {
      return candidate.error;
    }
  }

  return fallback;
}

export default function TodayAttendanceClient({
  productionId,
  productionTimeZone,
  blocks,
}: TodayAttendanceClientProps) {
  const dateTime = useBrowserDateTime();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runStaffAction(
    rehearsalId: string,
    userId: string,
    action: "MARK_NO_SHOW" | "CLEAR_TO_PRESENT"
  ) {
    setActiveKey(`${rehearsalId}:${userId}:${action}`);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/productions/${encodeURIComponent(productionId)}/rehearsals/${encodeURIComponent(rehearsalId)}/attendance/${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
          }),
        }
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Unable to update attendance."));
      }

      setMessage(
        action === "MARK_NO_SHOW"
          ? "Attendance marked as no-show."
          : "Attendance cleared to present."
      );
      startTransition(() => {
        router.refresh();
      });
    } catch (staffError) {
      setError(
        staffError instanceof Error ? staffError.message : "Request failed."
      );
    } finally {
      setActiveKey(null);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
      {message ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {blocks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
          No rehearsal blocks overlap today in {productionTimeZone}.
        </div>
      ) : (
        <div className="grid gap-4">
          {blocks.map((block) => (
            <article
              key={block.id}
              className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <a
                    href={`/app/productions/${productionId}/rehearsals/${block.id}`}
                    className="font-semibold text-white hover:text-amber-200"
                  >
                    {block.title}
                  </a>
                  <p className="mt-1 text-sm text-slate-300">
                    {dateTime.formatInstant(block.start, productionTimeZone)} to{" "}
                    {dateTime.formatInstant(block.end, productionTimeZone)}
                  </p>
                </div>

                <span className="rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1 text-xs text-slate-300">
                  {block.calledUserCount} called
                </span>
              </div>

              <div className="mt-4 grid gap-3">
                {block.roster.map((entry) => (
                  <div
                    key={`${block.id}-${entry.userId}`}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium text-white">{entry.name}</h3>
                        <p className="text-xs text-slate-400">
                          {entry.email} · {entry.role}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs ${statusBadge(
                            entry.status
                          )}`}
                        >
                          {entry.status.replace(/_/g, " ")}
                        </span>
                        <span className="rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1 text-xs text-slate-400">
                          {entry.hasExplicitRow ? "Explicit record" : "Implied present"}
                        </span>
                      </div>
                    </div>

                    {entry.note ? (
                      <p className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-sm text-slate-200">
                        {entry.note}
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        className="rounded-xl border border-rose-500/60 px-4 py-2 text-sm text-rose-100 hover:border-rose-400 disabled:opacity-60"
                        disabled={
                          isPending ||
                          activeKey === `${block.id}:${entry.userId}:MARK_NO_SHOW` ||
                          entry.status === "REPORTED_ABSENT" ||
                          entry.status === "NO_SHOW"
                        }
                        onClick={() =>
                          runStaffAction(block.id, entry.userId, "MARK_NO_SHOW")
                        }
                      >
                        Mark no-show
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 disabled:opacity-60"
                        disabled={
                          isPending ||
                          activeKey === `${block.id}:${entry.userId}:CLEAR_TO_PRESENT` ||
                          entry.status === "PRESENT"
                        }
                        onClick={() =>
                          runStaffAction(block.id, entry.userId, "CLEAR_TO_PRESENT")
                        }
                      >
                        Clear to present
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
