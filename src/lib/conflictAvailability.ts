function parseDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function clipWindowToHorizon(windowStart: string, windowEnd: string, horizonStart: Date, horizonEnd: Date) {
  const start = parseDate(windowStart);
  const end = parseDate(windowEnd);

  if (!start || !end || end <= start) {
    return null;
  }

  const clippedStart = new Date(Math.max(start.getTime(), horizonStart.getTime()));
  const clippedEnd = new Date(Math.min(end.getTime(), horizonEnd.getTime()));

  if (clippedEnd <= clippedStart) {
    return null;
  }

  return {
    start: clippedStart.toISOString(),
    end: clippedEnd.toISOString(),
  };
}

function mergeWindows(windows: Array<{ start: string; end: string }>) {
  const parsed = windows
    .map((window) => {
      const start = parseDate(window.start);
      const end = parseDate(window.end);

      if (!start || !end || end <= start) {
        return null;
      }

      return { start, end };
    })
    .filter((window): window is { start: Date; end: Date } => Boolean(window))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: Array<{ start: string; end: string }> = [];

  for (const window of parsed) {
    const previous = merged[merged.length - 1];

    if (!previous) {
      merged.push({
        start: window.start.toISOString(),
        end: window.end.toISOString(),
      });
      continue;
    }

    const previousEnd = parseDate(previous.end);
    if (!previousEnd) {
      continue;
    }

    if (window.start.getTime() <= previousEnd.getTime()) {
      previous.end = new Date(
        Math.max(previousEnd.getTime(), window.end.getTime())
      ).toISOString();
      continue;
    }

    merged.push({
      start: window.start.toISOString(),
      end: window.end.toISOString(),
    });
  }

  return merged;
}

export function buildAvailabilityFromConflicts({
  conflicts,
  horizonStart,
  horizonEnd,
}: {
  conflicts: Array<{ start: string; end: string }>;
  horizonStart: Date;
  horizonEnd: Date;
}) {
  const clippedConflicts = mergeWindows(
    conflicts
      .map((window) =>
        clipWindowToHorizon(window.start, window.end, horizonStart, horizonEnd)
      )
      .filter((window): window is { start: string; end: string } => Boolean(window))
  );

  const availability: Array<{ start: string; end: string }> = [];
  let cursorMs = horizonStart.getTime();

  for (const conflict of clippedConflicts) {
    const conflictStart = parseDate(conflict.start);
    const conflictEnd = parseDate(conflict.end);

    if (!conflictStart || !conflictEnd) {
      continue;
    }

    if (cursorMs < conflictStart.getTime()) {
      availability.push({
        start: new Date(cursorMs).toISOString(),
        end: conflictStart.toISOString(),
      });
    }

    cursorMs = Math.max(cursorMs, conflictEnd.getTime());
  }

  if (cursorMs < horizonEnd.getTime()) {
    availability.push({
      start: new Date(cursorMs).toISOString(),
      end: horizonEnd.toISOString(),
    });
  }

  return availability;
}
