import {
  formatTimeLabel,
  utcToZoned,
  zonedToUtc,
  type LocalDate,
  type LocalWallClock,
} from "@/lib/availabilityTime";

const DEFAULT_INSTANT_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
};

const DEFAULT_LOCAL_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: "short",
  month: "short",
  day: "numeric",
};

const DEFAULT_TIME_LABEL_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
};

const SHORT_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const LONG_MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SHORT_WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLocalDateAnchor(local: LocalDate, timeZone: string) {
  return (
    zonedToUtc(
      { year: local.year, month: local.month, day: local.day, hour: 12, minute: 0 },
      timeZone,
      { rejectNonexistent: false }
    ) ?? new Date(Date.UTC(local.year, local.month - 1, local.day, 12, 0))
  );
}

function matchesTimeLabelOptions(options: Intl.DateTimeFormatOptions) {
  const keys = Object.keys(options);
  return keys.length === 2 && options.hour === "numeric" && options.minute === "2-digit";
}

function pad2(value: number) {
  return value.toString().padStart(2, "0");
}

function getResolvedDateOptions(options: Intl.DateTimeFormatOptions) {
  if (options.dateStyle === "medium") {
    return {
      year: "numeric",
      month: "short",
      day: "numeric",
    } as const;
  }

  return {
    weekday: options.weekday,
    year: options.year,
    month: options.month,
    day: options.day,
  };
}

function getResolvedTimeOptions(options: Intl.DateTimeFormatOptions) {
  if (options.timeStyle === "short") {
    return {
      hour: "numeric",
      minute: "2-digit",
    } as const;
  }

  return {
    hour: options.hour,
    minute: options.minute,
  };
}

function getWeekdayName(local: LocalDate) {
  const weekdayIndex = new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay();
  return SHORT_WEEKDAY_NAMES[weekdayIndex] ?? SHORT_WEEKDAY_NAMES[0];
}

function getMonthName(month: number, width: "short" | "long") {
  const index = month - 1;
  return width === "long" ? LONG_MONTH_NAMES[index] ?? "" : SHORT_MONTH_NAMES[index] ?? "";
}

function formatDeterministicDate(local: LocalDate, options: Intl.DateTimeFormatOptions) {
  const resolved = getResolvedDateOptions(options);
  const monthWidth = resolved.month === "long" ? "long" : "short";
  const dateParts: string[] = [];

  if (resolved.month) {
    dateParts.push(getMonthName(local.month, monthWidth));
  }

  if (resolved.day) {
    if (resolved.month) {
      dateParts.push(local.day.toString());
    } else {
      dateParts.push(pad2(local.day));
    }
  }

  if (resolved.year) {
    if (dateParts.length > 0) {
      dateParts.push(local.year.toString());
    } else {
      dateParts.push(local.year.toString());
    }
  }

  const dateText = dateParts.join(" ").trim();
  if (resolved.weekday) {
    const weekdayText = getWeekdayName(local);
    return dateText ? `${weekdayText}, ${dateText}` : weekdayText;
  }

  return dateText;
}

function formatDeterministicTime(local: Pick<LocalWallClock, "hour" | "minute">) {
  return `${pad2(local.hour)}:${pad2(local.minute)}`;
}

function formatDeterministicInstant(
  local: LocalWallClock,
  options: Intl.DateTimeFormatOptions
) {
  const dateText = formatDeterministicDate(
    { year: local.year, month: local.month, day: local.day },
    options
  );
  const resolvedTime = getResolvedTimeOptions(options);
  const timeText =
    resolvedTime.hour || resolvedTime.minute ? formatDeterministicTime(local) : "";

  if (dateText && timeText) {
    return `${dateText}, ${timeText}`;
  }

  if (dateText) {
    return dateText;
  }

  if (timeText) {
    return timeText;
  }

  return `${local.year}-${pad2(local.month)}-${pad2(local.day)} ${formatDeterministicTime(
    local
  )}`;
}

export function formatInstantForLocale(
  value: string | Date,
  timeZone: string,
  locale: string,
  options: Intl.DateTimeFormatOptions = DEFAULT_INSTANT_OPTIONS
) {
  const date = toDate(value);
  if (!date) {
    return typeof value === "string" ? value : "";
  }

  return new Intl.DateTimeFormat(locale, {
    timeZone,
    ...options,
  }).format(date);
}

export function formatInstantFallback(
  value: string | Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = DEFAULT_INSTANT_OPTIONS
) {
  const date = toDate(value);
  if (!date) {
    return typeof value === "string" ? value : "";
  }

  return formatDeterministicInstant(utcToZoned(date, timeZone), options);
}

export function formatBrowserZoneInstantForLocale(
  value: string | Date,
  locale: string,
  options: Intl.DateTimeFormatOptions = DEFAULT_INSTANT_OPTIONS
) {
  const date = toDate(value);
  if (!date) {
    return typeof value === "string" ? value : "";
  }

  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatBrowserZoneInstantFallback(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = DEFAULT_INSTANT_OPTIONS
) {
  return formatInstantFallback(value, "UTC", options);
}

export function formatLocalDateForLocale(
  local: LocalDate,
  timeZone: string,
  locale: string,
  options: Intl.DateTimeFormatOptions = DEFAULT_LOCAL_DATE_OPTIONS
) {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    ...options,
  }).format(getLocalDateAnchor(local, timeZone));
}

export function formatLocalDateFallback(
  local: LocalDate,
  _timeZone: string,
  options: Intl.DateTimeFormatOptions = DEFAULT_LOCAL_DATE_OPTIONS
) {
  return formatDeterministicDate(local, options);
}

export function formatTimeLabelForLocale(
  minutes: number,
  locale: string,
  options: Intl.DateTimeFormatOptions = DEFAULT_TIME_LABEL_OPTIONS
) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const date = new Date(Date.UTC(2000, 0, 1, hour, minute));

  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    ...options,
  }).format(date);
}

export function formatTimeLabelFallback(
  minutes: number,
  options: Intl.DateTimeFormatOptions = DEFAULT_TIME_LABEL_OPTIONS
) {
  if (matchesTimeLabelOptions(options)) {
    return formatTimeLabel(minutes);
  }

  return formatTimeLabelForLocale(minutes, "en-US", options);
}
