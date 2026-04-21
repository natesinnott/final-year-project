"use client";

import { useCallback, useEffect, useState } from "react";
import { useBrowserDateTime } from "@/lib/useBrowserDateTime";

type TeamWindow = {
  id: string;
  start: string;
  end: string;
};

type TeamMember = {
  userId: string;
  name: string;
  email: string;
  role: string;
  submittedAt: string | null;
  windows: TeamWindow[];
};

type MissingMember = {
  userId: string;
  name: string;
  role: string;
};

type TeamPayload = {
  members: TeamMember[];
  completeness: {
    is_complete: boolean;
    total_members: number;
    required_members: number;
    submitted_members: number;
    missing_members: MissingMember[];
  };
};

type TeamAvailabilityClientProps = {
  productionId: string;
};

export default function TeamAvailabilityClient({
  productionId,
}: TeamAvailabilityClientProps) {
  const dateTime = useBrowserDateTime();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TeamPayload | null>(null);

  const loadTeamAvailability = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/productions/${encodeURIComponent(productionId)}/availability/team`,
        { cache: "no-store" }
      );
      const payload = (await response.json()) as TeamPayload & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load cast and crew conflicts.");
      }

      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Request failed.");
    } finally {
      setIsLoading(false);
    }
  }, [productionId]);

  useEffect(() => {
    loadTeamAvailability();
  }, [loadTeamAvailability]);

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Completeness
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">Conflict status</h2>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              data?.completeness.is_complete
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                : "border-rose-500/40 bg-rose-500/10 text-rose-100"
            }`}
          >
            {data?.completeness.is_complete
              ? "Conflicts complete"
              : "Conflicts incomplete"}
          </span>
        </div>

        {data ? (
          <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
              Total members: <span className="text-white">{data.completeness.total_members}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
              Required: <span className="text-white">{data.completeness.required_members}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
              Submitted: <span className="text-white">{data.completeness.submitted_members}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
              Missing: <span className="text-white">{data.completeness.missing_members.length}</span>
            </div>
          </div>
        ) : null}

        {data && data.completeness.missing_members.length > 0 ? (
          <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4">
            <h3 className="text-sm font-semibold text-rose-100">
              Missing submissions
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-rose-100/90">
              {data.completeness.missing_members.map((member) => (
                <li key={member.userId}>
                  {member.name} ({member.role})
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Member conflicts</h2>
          <button
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500 disabled:opacity-60"
            onClick={loadTeamAvailability}
            disabled={isLoading}
          >
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="mt-4 text-sm text-slate-300">
            Loading conflicts...
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {!isLoading && !error && data ? (
          <div className="mt-4 grid gap-4">
            {data.members.map((member) => (
              <article
                key={member.userId}
                className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white">{member.name}</h3>
                    <p className="text-xs text-slate-400">
                      {member.email} · {member.role}
                    </p>
                  </div>
                  <span className="text-xs text-slate-300">
                    {member.submittedAt ? "Submitted" : "Not submitted"} ·{" "}
                    {member.windows.length} conflicts
                  </span>
                </div>

                {member.windows.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-400">
                    {member.submittedAt ? "No conflicts." : "No submission."}
                  </p>
                ) : (
                  <div className="mt-3 overflow-hidden rounded-lg border border-slate-800">
                    <div className="grid grid-cols-[1fr_1fr] gap-3 border-b border-slate-800 bg-slate-950/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      <div>Start</div>
                      <div>End</div>
                    </div>
                    {member.windows.map((window) => (
                      <div
                        key={window.id}
                        className="grid grid-cols-[1fr_1fr] gap-3 border-b border-slate-800 px-3 py-2 text-sm text-slate-200"
                      >
                        <div>{`${dateTime.formatBrowserZoneInstant(window.start)} (UTC: ${window.start})`}</div>
                        <div>{`${dateTime.formatBrowserZoneInstant(window.end)} (UTC: ${window.end})`}</div>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
