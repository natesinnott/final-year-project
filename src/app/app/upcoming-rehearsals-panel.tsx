"use client";

import { useState } from "react";

type RehearsalItem = {
  id: string;
  title: string;
  startsAt: string;
  location: string;
};

type UpcomingRehearsalsPanelProps = {
  productionId: string;
  rehearsals: RehearsalItem[];
};

export default function UpcomingRehearsalsPanel({
  productionId,
  rehearsals,
}: UpcomingRehearsalsPanelProps) {
  const [nowTimestamp] = useState(() => Date.now());

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Upcoming rehearsals</h2>
        <span className="text-xs text-slate-400">{rehearsals.length} scheduled</span>
      </div>
      <div className="mt-4 grid gap-3">
        {rehearsals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
            No published rehearsals are scheduled yet.
          </div>
        ) : (
          rehearsals.map((rehearsal, index) => {
            const rehearsalStart = new Date(rehearsal.startsAt);
            const startsInMs = rehearsalStart.getTime() - nowTimestamp;
            const isSoon =
              index === 0 && startsInMs > 0 && startsInMs <= 24 * 60 * 60 * 1000;

            return (
              <a
                key={rehearsal.id}
                href={`/app/productions/${productionId}/rehearsals`}
                className={`flex items-center justify-between rounded-xl border p-4 transition hover:border-slate-600 hover:bg-slate-900/40 ${
                  isSoon
                    ? "border-amber-400/50 bg-amber-400/10"
                    : "border-slate-800/70 bg-slate-950/40"
                }`}
              >
                <div>
                  <div className="font-medium text-white">{rehearsal.title}</div>
                  <div className="text-sm text-slate-400">{rehearsal.location}</div>
                  {isSoon ? (
                    <div className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">
                      Today / Soon
                    </div>
                  ) : null}
                </div>
                <div className="text-right text-sm font-medium text-slate-200">
                  {rehearsalStart.toLocaleString([], {
                    weekday: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </a>
            );
          })
        )}
      </div>
    </section>
  );
}
