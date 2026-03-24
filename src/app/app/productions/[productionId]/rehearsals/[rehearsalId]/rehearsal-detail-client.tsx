"use client";

import { useEffect, useState, useTransition } from "react";
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

type RehearsalDetailClientProps = {
  productionId: string;
  rehearsalId: string;
  productionTimeZone: string;
  canManageAttendance: boolean;
  detail: {
    id: string;
    title: string;
    start: string;
    end: string;
    calledUserCount: number;
  };
  selfAttendance?: {
    myStatus: "PRESENT" | "REPORTED_ABSENT" | "NO_SHOW";
    myNote: string | null;
    isCalledUser: boolean;
    canSelfReport: boolean;
  };
  roster?: RosterEntry[];
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

export default function RehearsalDetailClient({
  productionId,
  rehearsalId,
  productionTimeZone,
  canManageAttendance,
  detail,
  selfAttendance,
  roster = [],
}: RehearsalDetailClientProps) {
  const dateTime = useBrowserDateTime();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState(selfAttendance?.myNote ?? "");
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const rehearsalStarted = new Date(detail.start).getTime() <= Date.now();
  const myStatus = selfAttendance?.myStatus ?? "PRESENT";
  const canSelfReport = selfAttendance?.canSelfReport ?? false;
  const isCalledUser = selfAttendance?.isCalledUser ?? false;

  useEffect(() => {
    setNote(selfAttendance?.myNote ?? "");
  }, [selfAttendance?.myNote]);

  async function reportAbsence() {
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/productions/${encodeURIComponent(productionId)}/rehearsals/${encodeURIComponent(rehearsalId)}/attendance/me`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            note,
          }),
        }
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Unable to report absence."));
      }

      setMessage("Absence updated.");
      startTransition(() => {
        router.refresh();
      });
    } catch (reportError) {
      setError(
        reportError instanceof Error ? reportError.message : "Request failed."
      );
    }
  }

  async function clearOwnAbsence() {
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/productions/${encodeURIComponent(productionId)}/rehearsals/${encodeURIComponent(rehearsalId)}/attendance/me`,
        {
          method: "DELETE",
        }
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          getErrorMessage(payload, "Unable to clear the reported absence.")
        );
      }

      setMessage("Attendance reset to present.");
      startTransition(() => {
        router.refresh();
      });
    } catch (clearError) {
      setError(
        clearError instanceof Error ? clearError.message : "Request failed."
      );
    }
  }

  async function runStaffAction(
    userId: string,
    action: "MARK_NO_SHOW" | "CLEAR_TO_PRESENT"
  ) {
    setActiveUserId(userId);
    setError(null);
    setMessage(null);

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
      setActiveUserId(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.4fr]">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          Rehearsal
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">{detail.title}</h2>

        <div className="mt-4 grid gap-3 text-sm text-slate-300">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
            Start:{" "}
            <span className="text-white">
              {dateTime.formatInstant(detail.start, productionTimeZone)}
            </span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
            End:{" "}
            <span className="text-white">
              {dateTime.formatInstant(detail.end, productionTimeZone)}
            </span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
            Called users:{" "}
            <span className="text-white">{detail.calledUserCount}</span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
            Time zone: <span className="text-white">{productionTimeZone}</span>
          </div>
        </div>

        {!canManageAttendance ? (
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
              My attendance
            </h3>

            {!isCalledUser ? (
              <p className="mt-3 text-sm text-slate-400">
                You are not currently called to this rehearsal.
              </p>
            ) : (
              <>
                <div
                  className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs ${statusBadge(
                    myStatus
                  )}`}
                >
                  {myStatus.replace(/_/g, " ")}
                </div>
                <p className="mt-3 text-sm text-slate-300">
                  {canSelfReport
                    ? "Report or edit your absence before the rehearsal starts."
                    : "Self-reporting is closed once the rehearsal has started."}
                </p>
                {canSelfReport ? (
                  <>
                    <label className="mt-4 grid gap-2 text-sm text-slate-300">
                      <span className="font-medium text-white">Optional note</span>
                      <textarea
                        className="min-h-28 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-3 text-slate-100 outline-none focus:border-amber-300"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        disabled={isPending}
                      />
                    </label>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        className="rounded-xl bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
                        onClick={reportAbsence}
                        disabled={isPending}
                      >
                        {myStatus === "REPORTED_ABSENT"
                          ? "Update absence"
                          : "Report absence"}
                      </button>
                      {myStatus === "REPORTED_ABSENT" ? (
                        <button
                          type="button"
                          className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-200 hover:border-slate-500 disabled:opacity-60"
                          onClick={clearOwnAbsence}
                          disabled={isPending}
                        >
                          Clear back to present
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {message ? (
          <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Called roster
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">
              {canManageAttendance ? "Attendance controls" : "Called users"}
            </h2>
          </div>
          <span className="rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1 text-xs text-slate-300">
            {detail.calledUserCount} called
          </span>
        </div>

        {canManageAttendance ? (
          <div className="mt-4 grid gap-3">
            {roster.map((entry) => (
              <article
                key={entry.userId}
                className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">{entry.name}</h3>
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
                  <p className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 text-sm text-slate-200">
                    {entry.note}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="rounded-xl border border-rose-500/60 px-4 py-2 text-sm text-rose-100 hover:border-rose-400 disabled:opacity-60"
                    disabled={
                      activeUserId === entry.userId ||
                      isPending ||
                      rehearsalStarted === false ||
                      entry.status === "REPORTED_ABSENT" ||
                      entry.status === "NO_SHOW"
                    }
                    onClick={() => runStaffAction(entry.userId, "MARK_NO_SHOW")}
                  >
                    Mark no-show
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 disabled:opacity-60"
                    disabled={
                      activeUserId === entry.userId ||
                      isPending ||
                      entry.status === "PRESENT"
                    }
                    onClick={() => runStaffAction(entry.userId, "CLEAR_TO_PRESENT")}
                  >
                    Clear to present
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-6 text-sm text-slate-400">
            Only directors and stage managers can view the full called roster.
          </div>
        )}
      </section>
    </div>
  );
}
