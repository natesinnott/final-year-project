"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import WeeklyAvailabilityGrid from "./weekly-availability-grid";
import {
  CURATED_TIME_ZONES,
  addWeeks,
  detectSystemTimeZone,
  getWeekStartForInstant,
  isValidTimeZone,
  localDateKey,
  localRangeToUtc,
  zonedToUtc,
  type AvailabilityKind,
  type LocalDate,
  type LocalWallClock,
  type UtcWindow,
} from "@/lib/availabilityTime";

type AvailabilityClientProps = {
  productionId: string;
};

const TIMEZONE_STORAGE_KEY = "stagesuite.timezone";

function normalizeWindowsUtc(windows: UtcWindow[]) {
  return [...windows].sort((a, b) => a.start.localeCompare(b.start));
}

function parseApiWindows(payload: unknown): UtcWindow[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const maybeWindows = (payload as { windows?: unknown }).windows;
  if (!Array.isArray(maybeWindows)) {
    return [];
  }

  return maybeWindows
    .map((window) => {
      if (!window || typeof window !== "object") {
        return null;
      }

      const row = window as { id?: unknown; start?: unknown; end?: unknown; kind?: unknown };

      if (
        typeof row.id !== "string" ||
        typeof row.start !== "string" ||
        typeof row.end !== "string" ||
        (row.kind !== "AVAILABLE" && row.kind !== "UNAVAILABLE")
      ) {
        return null;
      }

      return {
        id: row.id,
        start: row.start,
        end: row.end,
        kind: row.kind,
      } as UtcWindow;
    })
    .filter((window): window is UtcWindow => window !== null);
}

export default function AvailabilityClient({ productionId }: AvailabilityClientProps) {
  const [windows, setWindows] = useState<UtcWindow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const detectedTimeZone = useMemo(() => detectSystemTimeZone(), []);
  const [displayTimeZone, setDisplayTimeZone] = useState<string>("UTC");
  const [timeZoneReady, setTimeZoneReady] = useState(false);
  const [tzSavedAt, setTzSavedAt] = useState<number | null>(null);

  const [paintKind, setPaintKind] = useState<AvailabilityKind>("AVAILABLE");
  const [weekAnchorUtc, setWeekAnchorUtc] = useState<string>(() => new Date().toISOString());
  const weekStart: LocalDate = useMemo(
    () => getWeekStartForInstant(weekAnchorUtc, displayTimeZone),
    [displayTimeZone, weekAnchorUtc]
  );

  useEffect(() => {
    const fromStorage = typeof window !== "undefined" ? window.localStorage.getItem(TIMEZONE_STORAGE_KEY) : null;
    const candidate = fromStorage && isValidTimeZone(fromStorage) ? fromStorage : detectedTimeZone;

    setDisplayTimeZone(candidate);
    setWeekAnchorUtc(new Date().toISOString());
    setTimeZoneReady(true);
  }, [detectedTimeZone]);

  useEffect(() => {
    if (!timeZoneReady || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(TIMEZONE_STORAGE_KEY, displayTimeZone);
    setTzSavedAt(Date.now());
  }, [displayTimeZone, timeZoneReady]);

  const loadWindows = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/productions/${encodeURIComponent(productionId)}/availability/me`,
        { cache: "no-store" }
      );

      const payload = (await response.json()) as { error?: string; windows?: unknown };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load availability.");
      }

      setWindows(normalizeWindowsUtc(parseApiWindows(payload)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Request failed.");
    } finally {
      setIsLoading(false);
    }
  }, [productionId]);

  useEffect(() => {
    loadWindows();
  }, [loadWindows]);

  const persistWindow = useCallback(
    async (startLocal: LocalWallClock, endLocal: LocalWallClock) => {
      setError(null);
      setMessage(null);

      const converted = localRangeToUtc(startLocal, endLocal, displayTimeZone);

      if (!converted) {
        setError(
          "That painted range includes a non-existent DST local slot or has invalid bounds. Try another time range."
        );
        return;
      }

      setIsSaving(true);
      try {
        const response = await fetch(
          `/api/productions/${encodeURIComponent(productionId)}/availability/me`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              start: converted.startUtcIso,
              end: converted.endUtcIso,
              kind: paintKind,
            }),
          }
        );

        const payload = (await response.json()) as UtcWindow & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to save availability window.");
        }

        setWindows((previous) =>
          normalizeWindowsUtc([
            ...previous,
            {
              id: payload.id,
              start: payload.start,
              end: payload.end,
              kind: payload.kind,
            },
          ])
        );

        setMessage("Availability window saved.");
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Request failed.");
      } finally {
        setIsSaving(false);
      }
    },
    [displayTimeZone, paintKind, productionId]
  );

  const deleteWindow = useCallback(
    async (windowId: string) => {
      if (isSaving) {
        return;
      }

      setIsSaving(true);
      setError(null);
      setMessage(null);

      try {
        const response = await fetch(
          `/api/productions/${encodeURIComponent(productionId)}/availability/me/${encodeURIComponent(windowId)}`,
          {
            method: "DELETE",
          }
        );

        const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to delete availability window.");
        }

        setWindows((previous) => previous.filter((window) => window.id !== windowId));
        setMessage("Availability window deleted.");
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Request failed.");
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving, productionId]
  );

  const timezoneOptions = useMemo(() => {
    const base = [detectedTimeZone, "UTC", "America/New_York", ...CURATED_TIME_ZONES];
    return Array.from(new Set(base));
  }, [detectedTimeZone]);

  const setWeekFromLocalStart = useCallback(
    (local: LocalDate) => {
      const utc = zonedToUtc(
        { year: local.year, month: local.month, day: local.day, hour: 0, minute: 0 },
        displayTimeZone,
        { rejectNonexistent: false }
      );
      if (utc) {
        setWeekAnchorUtc(utc.toISOString());
      }
    },
    [displayTimeZone]
  );

  const saveBadgeVisible = tzSavedAt !== null && Date.now() - tzSavedAt < 2500;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Your weekly availability
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">Manage your availability</h2>
          <p className="mt-2 text-sm text-slate-300">
            Displayed in <span className="font-semibold text-slate-100">{displayTimeZone}</span>. Saved in UTC.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400" htmlFor="availability-timezone">
            Time zone
          </label>
          <select
            id="availability-timezone"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            value={displayTimeZone}
            onChange={(event) => {
              const nextTz = event.target.value;
              setDisplayTimeZone(nextTz);
              setWeekAnchorUtc(new Date().toISOString());
            }}
          >
            <option value={detectedTimeZone}>Local (Detected) · {detectedTimeZone}</option>
            {timezoneOptions.map((timezone) => (
              <option key={timezone} value={timezone}>
                {timezone}
              </option>
            ))}
          </select>
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 text-xs text-slate-300"
            title="Your selected timezone is used for viewing and editing the weekly grid. Availability is always stored and sent to the API in UTC."
          >
            ?
          </span>
          {saveBadgeVisible ? (
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">
              Saved
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
            onClick={() => setWeekFromLocalStart(addWeeks(weekStart, -1))}
            disabled={isSaving}
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
            onClick={() => setWeekAnchorUtc(new Date().toISOString())}
            disabled={isSaving}
          >
            This week
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500"
            onClick={() => setWeekFromLocalStart(addWeeks(weekStart, 1))}
            disabled={isSaving}
          >
            Next
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Paint as</span>
          <select
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            value={paintKind}
            onChange={(event) => setPaintKind(event.target.value as AvailabilityKind)}
            disabled={isSaving}
          >
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="UNAVAILABLE">UNAVAILABLE</option>
          </select>
        </div>
      </div>

      <div className="mt-4">
        {isLoading || !timeZoneReady ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
            Loading availability...
          </div>
        ) : (
          <WeeklyAvailabilityGrid
            windows={windows}
            weekStart={weekStart}
            displayTimeZone={displayTimeZone}
            isBusy={isSaving}
            onPaintRange={persistWindow}
            onDeleteWindow={deleteWindow}
          />
        )}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Week key: {localDateKey(weekStart)} ({displayTimeZone})
      </p>

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
  );
}
