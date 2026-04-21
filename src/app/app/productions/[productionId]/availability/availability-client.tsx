"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBrowserDateTime } from "@/lib/useBrowserDateTime";
import {
  CURATED_TIME_ZONES,
  detectSystemTimeZone,
  isValidTimeZone,
  localRangeToUtc,
  parseLocalDateTimeInput,
  utcToDateTimeInputValue,
  zonedToUtc,
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

      const row = window as { id?: unknown; start?: unknown; end?: unknown };

      if (
        typeof row.id !== "string" ||
        typeof row.start !== "string" ||
        typeof row.end !== "string"
      ) {
        return null;
      }

      return {
        id: row.id,
        start: row.start,
        end: row.end,
      } as UtcWindow;
    })
    .filter((window): window is UtcWindow => window !== null);
}

function parseSubmittedAt(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const submittedAt = (payload as { submittedAt?: unknown }).submittedAt;
  return typeof submittedAt === "string" && submittedAt.length > 0 ? submittedAt : null;
}

function convertDraftValueBetweenTimeZones(
  value: string,
  fromTimeZone: string,
  toTimeZone: string
) {
  if (value.length === 0 || fromTimeZone === toTimeZone) {
    return value;
  }

  const local = parseLocalDateTimeInput(value);
  if (!local) {
    return "";
  }

  const utc = zonedToUtc(local, fromTimeZone, { rejectNonexistent: true });
  return utc ? utcToDateTimeInputValue(utc, toTimeZone) : "";
}

export default function AvailabilityClient({ productionId }: AvailabilityClientProps) {
  const dateTime = useBrowserDateTime();
  const [windows, setWindows] = useState<UtcWindow[]>([]);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");

  const detectedTimeZone = useMemo(() => detectSystemTimeZone(), []);
  const [displayTimeZone, setDisplayTimeZone] = useState<string>("UTC");
  const [timeZoneReady, setTimeZoneReady] = useState(false);
  const [tzSavedAt, setTzSavedAt] = useState<number | null>(null);

  useEffect(() => {
    const fromStorage =
      typeof window !== "undefined" ? window.localStorage.getItem(TIMEZONE_STORAGE_KEY) : null;
    const candidate = fromStorage && isValidTimeZone(fromStorage) ? fromStorage : detectedTimeZone;

    setDisplayTimeZone(candidate);
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

      const payload = (await response.json()) as {
        error?: string;
        submittedAt?: unknown;
        windows?: unknown;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load conflicts.");
      }

      setWindows(normalizeWindowsUtc(parseApiWindows(payload)));
      setSubmittedAt(parseSubmittedAt(payload));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Request failed.");
    } finally {
      setIsLoading(false);
    }
  }, [productionId]);

  useEffect(() => {
    loadWindows();
  }, [loadWindows]);

  const persistWindow = useCallback(async () => {
    if (isSaving) {
      return;
    }

    const startLocal = parseLocalDateTimeInput(draftStart);
    const endLocal = parseLocalDateTimeInput(draftEnd);

    if (!startLocal || !endLocal) {
      setError("Enter a valid start and end date/time.");
      setMessage(null);
      return;
    }

    setError(null);
    setMessage(null);

    const converted = localRangeToUtc(startLocal, endLocal, displayTimeZone);

    if (!converted) {
      setError(
        "That conflict range includes a non-existent DST local slot or has invalid bounds. Try another time range."
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
          }),
        }
      );

      const payload = (await response.json()) as UtcWindow & {
        error?: string;
        submittedAt?: unknown;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save conflict.");
      }

      setWindows((previous) =>
        normalizeWindowsUtc([
          ...previous,
          {
            id: payload.id,
            start: payload.start,
            end: payload.end,
          },
        ])
      );

      setSubmittedAt(parseSubmittedAt(payload));
      setDraftStart("");
      setDraftEnd("");
      setMessage("Conflict saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Request failed.");
    } finally {
      setIsSaving(false);
    }
  }, [displayTimeZone, draftEnd, draftStart, isSaving, productionId]);

  const deleteWindow = useCallback(
    async (windowId: string) => {
      if (isSaving) {
        return;
      }

      setError(null);
      setMessage(null);

      setIsSaving(true);
      try {
        const response = await fetch(
          `/api/productions/${encodeURIComponent(productionId)}/availability/me/${encodeURIComponent(windowId)}`,
          {
            method: "DELETE",
          }
        );

        const payload = (await response.json()) as {
          error?: string;
          submittedAt?: unknown;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to delete conflict.");
        }

        setWindows((previous) => previous.filter((window) => window.id !== windowId));
        setSubmittedAt(parseSubmittedAt(payload) ?? submittedAt);
        setMessage("Conflict deleted.");
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Request failed.");
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving, productionId, submittedAt]
  );

  const submitConflicts = useCallback(async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/productions/${encodeURIComponent(productionId)}/availability/me/submission`,
        {
          method: "POST",
        }
      );

      const payload = (await response.json()) as {
        error?: string;
        submittedAt?: unknown;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to submit conflicts.");
      }

      setSubmittedAt(parseSubmittedAt(payload));
      setMessage(windows.length === 0 ? "No conflicts submitted." : "Conflicts submitted.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Request failed.");
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, productionId, windows.length]);

  const timezoneOptions = useMemo(() => {
    const base = [detectedTimeZone, "UTC", "America/New_York", ...CURATED_TIME_ZONES];
    return Array.from(new Set(base));
  }, [detectedTimeZone]);

  const saveBadgeVisible = tzSavedAt !== null && Date.now() - tzSavedAt < 2500;

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Your conflicts
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">Conflicts</h2>
          <p className="mt-2 text-sm text-slate-300">
            Shown in <span className="font-semibold text-slate-100">{displayTimeZone}</span>.
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
              setDraftStart((current) =>
                convertDraftValueBetweenTimeZones(current, displayTimeZone, nextTz)
              );
              setDraftEnd((current) =>
                convertDraftValueBetweenTimeZones(current, displayTimeZone, nextTz)
              );
              setDisplayTimeZone(nextTz);
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
            title="Used for entry and display. Stored in UTC."
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
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              submittedAt
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                : "border-amber-500/40 bg-amber-500/10 text-amber-100"
            }`}
          >
            {submittedAt ? "Conflicts submitted" : "Not submitted"}
          </span>
          {submittedAt ? (
            <span className="text-xs text-slate-400">
              Last submitted {dateTime.formatInstant(submittedAt, displayTimeZone)}
            </span>
          ) : null}
          {!submittedAt ? (
            <button
              type="button"
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:border-slate-500 disabled:opacity-60"
              onClick={submitConflicts}
              disabled={isSaving}
            >
              {windows.length === 0 ? "Submit none" : "Submit conflicts"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        {isLoading || !timeZoneReady ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
            Loading conflicts...
          </div>
        ) : (
          <div className="grid gap-4">
            <form
              className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void persistWindow();
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Add conflict</h3>
                  <p className="mt-1 text-xs text-slate-400">In {displayTimeZone}.</p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Start
                  </span>
                  <input
                    type="datetime-local"
                    step={900}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                    value={draftStart}
                    onChange={(event) => setDraftStart(event.target.value)}
                    disabled={isSaving}
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    End
                  </span>
                  <input
                    type="datetime-local"
                    step={900}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                    value={draftEnd}
                    onChange={(event) => setDraftEnd(event.target.value)}
                    disabled={isSaving}
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Add conflict"}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 disabled:opacity-60"
                  onClick={() => {
                    setDraftStart("");
                    setDraftEnd("");
                  }}
                  disabled={isSaving || (draftStart.length === 0 && draftEnd.length === 0)}
                >
                  Clear
                </button>
              </div>
            </form>

            <section className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Saved conflicts</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Review conflicts in {displayTimeZone}. Deleting a conflict updates your latest
                    submission timestamp.
                  </p>
                </div>
                <span className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs font-semibold text-slate-200">
                  {windows.length} saved
                </span>
              </div>

              {windows.length === 0 ? (
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-300">
                  {submittedAt
                    ? "No conflicts submitted."
                    : "No conflicts added yet. Add a conflict or confirm that you have none."}
                </div>
              ) : (
                <div className="mt-4 grid gap-3">
                  {windows.map((window) => (
                    <article
                      key={window.id}
                      className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
                    >
                      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-start">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Start
                          </div>
                          <div className="mt-1 text-sm text-slate-100">
                            {dateTime.formatInstant(window.start, displayTimeZone)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">UTC {window.start}</div>
                        </div>

                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            End
                          </div>
                          <div className="mt-1 text-sm text-slate-100">
                            {dateTime.formatInstant(window.end, displayTimeZone)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">UTC {window.end}</div>
                        </div>

                        <button
                          type="button"
                          className="rounded-lg border border-rose-500/40 px-3 py-2 text-sm text-rose-100 hover:border-rose-400 disabled:opacity-60"
                          onClick={() => deleteWindow(window.id)}
                          disabled={isSaving}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

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
