"use client";

import { useSyncExternalStore } from "react";
import type { LocalDate } from "@/lib/availabilityTime";
import {
  formatBrowserZoneInstantFallback,
  formatBrowserZoneInstantForLocale,
  formatInstantFallback,
  formatInstantForLocale,
  formatLocalDateFallback,
  formatLocalDateForLocale,
} from "@/lib/dateTimeDisplay";

function subscribe() {
  return () => {};
}

function getBrowserLocaleSnapshot() {
  return Intl.DateTimeFormat().resolvedOptions().locale;
}

function getServerLocaleSnapshot() {
  return null;
}

export function useBrowserDateTime() {
  // Server components render deterministic fallback strings first; switch to the
  // real browser locale only after hydration to avoid mismatched date text.
  const browserLocale = useSyncExternalStore(
    subscribe,
    getBrowserLocaleSnapshot,
    getServerLocaleSnapshot
  );

  function formatInstant(
    value: string | Date,
    timeZone: string,
    options?: Intl.DateTimeFormatOptions
  ) {
    if (!browserLocale) {
      return formatInstantFallback(value, timeZone, options);
    }

    return formatInstantForLocale(value, timeZone, browserLocale, options);
  }

  function formatBrowserZoneInstant(
    value: string | Date,
    options?: Intl.DateTimeFormatOptions
  ) {
    if (!browserLocale) {
      return formatBrowserZoneInstantFallback(value, options);
    }

    return formatBrowserZoneInstantForLocale(value, browserLocale, options);
  }

  function formatLocalDate(
    local: LocalDate,
    timeZone: string,
    options?: Intl.DateTimeFormatOptions
  ) {
    if (!browserLocale) {
      return formatLocalDateFallback(local, timeZone, options);
    }

    return formatLocalDateForLocale(local, timeZone, browserLocale, options);
  }

  return {
    formatInstant,
    formatBrowserZoneInstant,
    formatLocalDate,
  };
}
