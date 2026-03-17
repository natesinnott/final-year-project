"use client";

import { useMemo, useState } from "react";
import {
  formatInstantInTimeZone,
  getLocalDateForInstant,
  localDateKey,
  zonedToUtc,
  type LocalDate,
} from "@/lib/availabilityTime";

type RehearsalRow = {
  id: string;
  title: string;
  start: string;
  end: string;
  calledUserCount: number;
  absentCount: number;
  noShowCount: number;
  myStatus: "PRESENT" | "REPORTED_ABSENT" | "NO_SHOW";
};

type ProductionRehearsalsClientProps = {
  productionId: string;
  venue: string | null;
  productionTimeZone: string;
  canManageAttendance: boolean;
  canViewAllRehearsals: boolean;
  rehearsals: RehearsalRow[];
};

type CalendarDay = {
  date: LocalDate;
  isCurrentMonth: boolean;
};

function formatMonthLabel(date: LocalDate, timeZone: string) {
  const utc = zonedToUtc(
    { year: date.year, month: date.month, day: 15, hour: 12, minute: 0 },
    timeZone,
    { rejectNonexistent: false }
  );

  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    month: "long",
    year: "numeric",
  }).format(
    utc ?? new Date(Date.UTC(date.year, date.month - 1, 15, 12, 0))
  );
}

function addCalendarDays(date: LocalDate, days: number): LocalDate {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days));

  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function getMonthStart(date: LocalDate): LocalDate {
  return {
    year: date.year,
    month: date.month,
    day: 1,
  };
}

function addCalendarMonths(date: LocalDate, months: number): LocalDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1 + months, 1));

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: 1,
  };
}

function getMonthGrid(anchor: LocalDate): CalendarDay[] {
  const monthStart = getMonthStart(anchor);
  const firstWeekday = (new Date(
    Date.UTC(monthStart.year, monthStart.month - 1, monthStart.day)
  ).getUTCDay() + 6) % 7;
  const gridStart = addCalendarDays(monthStart, -firstWeekday);
  const nextMonthStart = addCalendarMonths(monthStart, 1);
  const daysInMonth =
    (Date.UTC(nextMonthStart.year, nextMonthStart.month - 1, nextMonthStart.day) -
      Date.UTC(monthStart.year, monthStart.month - 1, monthStart.day)) /
    (24 * 60 * 60 * 1000);
  const gridLength = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  return Array.from({ length: gridLength }, (_, index) => {
    const date = addCalendarDays(gridStart, index);

    return {
      date,
      isCurrentMonth: date.month === anchor.month,
    };
  });
}

function statusClasses(status: RehearsalRow["myStatus"]) {
  if (status === "REPORTED_ABSENT") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-100";
  }

  if (status === "NO_SHOW") {
    return "border-rose-500/40 bg-rose-500/10 text-rose-100";
  }

  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
}

export default function ProductionRehearsalsClient({
  productionId,
  venue,
  productionTimeZone,
  canManageAttendance,
  canViewAllRehearsals,
  rehearsals,
}: ProductionRehearsalsClientProps) {
  const [view, setView] = useState<"list" | "calendar">("list");
  const today = useMemo(
    () => getLocalDateForInstant(new Date(), productionTimeZone),
    [productionTimeZone]
  );
  const [monthAnchor, setMonthAnchor] = useState<LocalDate>({
    year: today.year,
    month: today.month,
    day: 1,
  });

  const rehearsalsByDay = useMemo(() => {
    const grouped = new Map<string, RehearsalRow[]>();

    for (const rehearsal of rehearsals) {
      const key = localDateKey(
        getLocalDateForInstant(rehearsal.start, productionTimeZone)
      );
      const existing = grouped.get(key);

      if (existing) {
        existing.push(rehearsal);
      } else {
        grouped.set(key, [rehearsal]);
      }
    }

    for (const entries of grouped.values()) {
      entries.sort((a, b) => a.start.localeCompare(b.start));
    }

    return grouped;
  }, [productionTimeZone, rehearsals]);

  const monthGrid = useMemo(() => getMonthGrid(monthAnchor), [monthAnchor]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Rehearsal blocks
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Displayed in {productionTimeZone}. {rehearsals.length} published block
            {rehearsals.length === 1 ? "" : "s"} visible.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-1">
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm ${
              view === "list"
                ? "bg-amber-300 font-semibold text-slate-950"
                : "text-slate-200"
            }`}
            onClick={() => setView("list")}
          >
            List
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm ${
              view === "calendar"
                ? "bg-amber-300 font-semibold text-slate-950"
                : "text-slate-200"
            }`}
            onClick={() => setView("calendar")}
          >
            Calendar
          </button>
        </div>
      </div>

      {rehearsals.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
          No published rehearsals are scheduled yet.
        </div>
      ) : null}

      {view === "list" && rehearsals.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {rehearsals.map((rehearsal) => (
            <a
              key={rehearsal.id}
              href={`/app/productions/${productionId}/rehearsals/${rehearsal.id}`}
              className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 transition hover:border-slate-600"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-white">{rehearsal.title}</h3>
                  <p className="mt-1 text-sm text-slate-300">
                    {formatInstantInTimeZone(rehearsal.start, productionTimeZone)} to{" "}
                    {formatInstantInTimeZone(rehearsal.end, productionTimeZone, {
                      timeStyle: "short",
                    })}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {venue ?? "Default room"} · Called users: {rehearsal.calledUserCount}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canManageAttendance ? (
                    <>
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-100">
                        Reported absent: {rehearsal.absentCount}
                      </span>
                      <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-100">
                        No-show: {rehearsal.noShowCount}
                      </span>
                    </>
                  ) : (
                    <span
                      className={`rounded-full border px-3 py-1 text-xs ${statusClasses(
                        rehearsal.myStatus
                      )}`}
                    >
                      {rehearsal.myStatus.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      ) : null}

      {view === "calendar" && rehearsals.length > 0 ? (
        <div className="mt-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {formatMonthLabel(monthAnchor, productionTimeZone)}
              </h3>
              <p className="text-sm text-slate-400">
                Monday-first month view
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
                onClick={() => setMonthAnchor((current) => addCalendarMonths(current, -1))}
              >
                Prev
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
                onClick={() =>
                  setMonthAnchor({ year: today.year, month: today.month, day: 1 })
                }
              >
                This month
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
                onClick={() => setMonthAnchor((current) => addCalendarMonths(current, 1))}
              >
                Next
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-slate-800 bg-slate-800">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
              <div
                key={label}
                className="bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"
              >
                {label}
              </div>
            ))}

            {monthGrid.map((day) => {
              const dayKey = localDateKey(day.date);
              const dayRehearsals = rehearsalsByDay.get(dayKey) ?? [];

              return (
                <div
                  key={dayKey}
                  className={`min-h-40 bg-slate-950/50 p-2 ${
                    day.isCurrentMonth ? "text-slate-200" : "text-slate-500"
                  }`}
                >
                  <div className="mb-2 text-sm font-semibold">
                    {day.date.day}
                  </div>
                  <div className="grid gap-2">
                    {dayRehearsals.map((rehearsal) => (
                      <a
                        key={rehearsal.id}
                        href={`/app/productions/${productionId}/rehearsals/${rehearsal.id}`}
                        className="rounded-xl border border-slate-700 bg-slate-900/70 px-2 py-2 text-xs text-slate-100 transition hover:border-slate-500"
                      >
                        <div className="font-semibold text-white">
                          {rehearsal.title}
                        </div>
                        <div className="mt-1 text-slate-300">
                          {formatInstantInTimeZone(rehearsal.start, productionTimeZone, {
                            timeStyle: "short",
                          })}
                        </div>
                        <div className="mt-1 text-slate-400">
                          {canManageAttendance
                            ? `${rehearsal.absentCount} absent · ${rehearsal.noShowCount} no-show`
                            : rehearsal.myStatus.replace(/_/g, " ")}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <p className="mt-4 text-xs text-slate-400">
        {canViewAllRehearsals
          ? "Attendance staff can see every published rehearsal in this production."
          : "You only see rehearsal blocks where you are currently called."}
      </p>
    </section>
  );
}
