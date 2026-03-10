const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export type AvailabilityKind = "AVAILABLE" | "UNAVAILABLE";

export type UtcWindow = {
  id: string;
  start: string;
  end: string;
  kind: AvailabilityKind;
};

export type LocalWallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export type LocalDate = {
  year: number;
  month: number;
  day: number;
};

export type WeekSegment = {
  id: string;
  kind: AvailabilityKind;
  dayIndex: number;
  startMinute: number;
  endMinute: number;
};

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function getDtf(timeZone: string) {
  const key = timeZone;
  const existing = dtfCache.get(key);
  if (existing) {
    return existing;
  }

  const created = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "shortOffset",
  });

  dtfCache.set(key, created);
  return created;
}

function getOffsetMinutes(utcMs: number, timeZone: string) {
  const dtf = getDtf(timeZone);
  const parts = dtf.formatToParts(new Date(utcMs));
  const offsetPart = parts.find((part) => part.type === "timeZoneName")?.value;

  if (!offsetPart) {
    return 0;
  }

  if (offsetPart === "GMT" || offsetPart === "UTC") {
    return 0;
  }

  const match = offsetPart.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    return 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number.parseInt(match[2] ?? "0", 10);
  const minutes = Number.parseInt(match[3] ?? "0", 10);
  return sign * (hours * 60 + minutes);
}

function toLocalParts(utcMs: number, timeZone: string): LocalWallClock {
  const dtf = getDtf(timeZone);
  const parts = dtf.formatToParts(new Date(utcMs));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number.parseInt(parts.find((part) => part.type === type)?.value ?? "0", 10);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
  };
}

function sameLocal(a: LocalWallClock, b: LocalWallClock) {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute
  );
}

function localToEpochGuess(local: LocalWallClock) {
  return Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
}

function compareLocalDate(a: LocalDate, b: LocalDate) {
  if (a.year !== b.year) {
    return a.year - b.year;
  }
  if (a.month !== b.month) {
    return a.month - b.month;
  }
  return a.day - b.day;
}

function addLocalDays(local: LocalDate, days: number): LocalDate {
  const baseMs = Date.UTC(local.year, local.month - 1, local.day);
  const next = new Date(baseMs + days * DAY_MS);
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function detectSystemTimeZone() {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return detected && isValidTimeZone(detected) ? detected : "UTC";
}

export function utcToZoned(utcInstant: string | Date, timeZone: string): LocalWallClock {
  const utcDate = utcInstant instanceof Date ? utcInstant : new Date(utcInstant);
  return toLocalParts(utcDate.getTime(), timeZone);
}

export function zonedToUtc(
  local: LocalWallClock,
  timeZone: string,
  options?: { rejectNonexistent?: boolean }
) {
  let candidate = localToEpochGuess(local);

  for (let index = 0; index < 6; index += 1) {
    const offsetMinutes = getOffsetMinutes(candidate, timeZone);
    const next = localToEpochGuess(local) - offsetMinutes * MINUTE_MS;
    if (next === candidate) {
      break;
    }
    candidate = next;
  }

  const lower = candidate - 3 * 60 * MINUTE_MS;
  const upper = candidate + 3 * 60 * MINUTE_MS;
  let firstMatch: number | null = null;

  for (let cursor = lower; cursor <= upper; cursor += MINUTE_MS) {
    if (sameLocal(toLocalParts(cursor, timeZone), local)) {
      firstMatch = cursor;
      break;
    }
  }

  if (firstMatch !== null) {
    // Fall-back ambiguity can map to two instants; keep the earlier one.
    return new Date(firstMatch);
  }

  if (options?.rejectNonexistent ?? true) {
    return null;
  }

  for (let cursor = candidate; cursor <= candidate + 4 * 60 * MINUTE_MS; cursor += MINUTE_MS) {
    const zoned = toLocalParts(cursor, timeZone);
    const targetDate = { year: local.year, month: local.month, day: local.day };
    const zonedDate = { year: zoned.year, month: zoned.month, day: zoned.day };

    if (compareLocalDate(zonedDate, targetDate) < 0) {
      continue;
    }

    if (
      zonedDate.year === targetDate.year &&
      zonedDate.month === targetDate.month &&
      zonedDate.day === targetDate.day &&
      (zoned.hour < local.hour || (zoned.hour === local.hour && zoned.minute < local.minute))
    ) {
      continue;
    }

    return new Date(cursor);
  }

  return null;
}

export function snapWallClockTo15(local: LocalWallClock, mode: "floor" | "ceil") {
  const minuteBucket = mode === "floor" ? Math.floor(local.minute / 15) : Math.ceil(local.minute / 15);
  const rawMinutes = minuteBucket * 15;

  if (rawMinutes <= 45) {
    return { ...local, minute: rawMinutes };
  }

  const rolled = new Date(Date.UTC(local.year, local.month - 1, local.day, local.hour, 0) + 60 * MINUTE_MS);
  return {
    year: rolled.getUTCFullYear(),
    month: rolled.getUTCMonth() + 1,
    day: rolled.getUTCDate(),
    hour: rolled.getUTCHours(),
    minute: 0,
  };
}

export function getWeekStartForLocalDate(localDate: LocalDate) {
  const date = new Date(Date.UTC(localDate.year, localDate.month - 1, localDate.day));
  const dayOfWeek = date.getUTCDay();
  return addLocalDays(localDate, -dayOfWeek);
}

export function getWeekStartForInstant(utcInstant: string | Date, timeZone: string) {
  const local = utcToZoned(utcInstant, timeZone);
  return getWeekStartForLocalDate({
    year: local.year,
    month: local.month,
    day: local.day,
  });
}

export function addWeeks(weekStart: LocalDate, offset: number) {
  return addLocalDays(weekStart, offset * 7);
}

export function localDateKey(local: LocalDate) {
  return `${local.year.toString().padStart(4, "0")}-${local.month
    .toString()
    .padStart(2, "0")}-${local.day.toString().padStart(2, "0")}`;
}

export function buildWeekDates(weekStart: LocalDate) {
  return Array.from({ length: 7 }, (_, index) => addLocalDays(weekStart, index));
}

export function localDateFromWallClock(local: LocalWallClock): LocalDate {
  return { year: local.year, month: local.month, day: local.day };
}

export function localMinuteOfDay(local: LocalWallClock) {
  return local.hour * 60 + local.minute;
}

export function localRangeToUtc(
  startLocal: LocalWallClock,
  endLocal: LocalWallClock,
  timeZone: string
): { startUtcIso: string; endUtcIso: string } | null {
  const snappedStart = snapWallClockTo15(startLocal, "floor");
  const snappedEnd = snapWallClockTo15(endLocal, "ceil");

  const startUtc = zonedToUtc(snappedStart, timeZone, { rejectNonexistent: true });
  const endUtc = zonedToUtc(snappedEnd, timeZone, { rejectNonexistent: true });

  if (!startUtc || !endUtc || endUtc <= startUtc) {
    return null;
  }

  return {
    startUtcIso: startUtc.toISOString(),
    endUtcIso: endUtc.toISOString(),
  };
}

export function splitWindowForWeek(
  window: UtcWindow,
  weekStart: LocalDate,
  timeZone: string
): WeekSegment[] {
  const startMs = new Date(window.start).getTime();
  const endMs = new Date(window.end).getTime();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return [];
  }

  const weekDates = buildWeekDates(weekStart);
  const dateToIndex = new Map(weekDates.map((date, index) => [localDateKey(date), index]));

  const segments: WeekSegment[] = [];
  let cursor = startMs;

  while (cursor < endMs) {
    const local = toLocalParts(cursor, timeZone);
    const key = localDateKey(localDateFromWallClock(local));
    const dayIndex = dateToIndex.get(key);

    const nextDayUtc = zonedToUtc(
      {
        year: local.year,
        month: local.month,
        day: local.day,
        hour: 24,
        minute: 0,
      },
      timeZone,
      { rejectNonexistent: false }
    );

    const chunkEndMs = Math.min(endMs, nextDayUtc?.getTime() ?? endMs);

    if (dayIndex !== undefined) {
      const localStart = toLocalParts(cursor, timeZone);
      const localEnd = toLocalParts(chunkEndMs, timeZone);
      const startMinute = localMinuteOfDay(localStart);
      const sameDate =
        localStart.year === localEnd.year &&
        localStart.month === localEnd.month &&
        localStart.day === localEnd.day;
      const endMinute =
        chunkEndMs === endMs ? (sameDate ? localMinuteOfDay(localEnd) : 24 * 60) : 24 * 60;

      if (endMinute > startMinute) {
        segments.push({
          id: window.id,
          kind: window.kind,
          dayIndex,
          startMinute,
          endMinute,
        });
      }
    }

    if (chunkEndMs <= cursor) {
      break;
    }

    cursor = chunkEndMs;
  }

  return segments;
}

export function formatLocalWeekday(local: LocalDate, timeZone: string) {
  const utcMidday = zonedToUtc(
    { year: local.year, month: local.month, day: local.day, hour: 12, minute: 0 },
    timeZone,
    { rejectNonexistent: false }
  );

  const date = utcMidday ?? new Date(Date.UTC(local.year, local.month - 1, local.day, 12, 0));

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatTimeLabel(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = ((hour + 11) % 12) + 1;
  return `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`;
}

export const CURATED_TIME_ZONES = [
  "UTC",
  "America/New_York",
  "Europe/London",
  "Europe/Paris",
  "America/Los_Angeles",
  "America/Chicago",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;
