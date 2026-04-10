"use client";

import { useEffect, useState } from "react";

export type SchedulerWarmupStatus = "starting" | "ready" | "unavailable";

const POLL_INTERVAL_MS = 5_000;
const WARMUP_TIMEOUT_MS = 90_000;

const STARTING_LABEL = "Starting scheduler...";
const READY_LABEL = "Run schedule";
const UNAVAILABLE_LABEL = "Scheduler unavailable.";

export function useSchedulerWarmup(productionId: string) {
  const [warmupState, setWarmupState] = useState<{
    productionId: string;
    status: SchedulerWarmupStatus;
  }>({
    productionId,
    status: "starting",
  });
  const status =
    warmupState.productionId === productionId ? warmupState.status : "starting";

  useEffect(() => {
    let isActive = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let currentController: AbortController | null = null;
    const startedAt = Date.now();

    async function pollHealth() {
      currentController = new AbortController();

      try {
        const response = await fetch(
          `/api/scheduler/health?productionId=${encodeURIComponent(productionId)}`,
          {
            cache: "no-store",
            signal: currentController.signal,
          }
        );

        if (!isActive) {
          return;
        }

        if (response.ok) {
          setWarmupState({
            productionId,
            status: "ready",
          });
          return;
        }
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }

      if (!isActive) {
        return;
      }

      if (Date.now() - startedAt >= WARMUP_TIMEOUT_MS) {
        setWarmupState({
          productionId,
          status: "unavailable",
        });
        return;
      }

      timeoutId = setTimeout(pollHealth, POLL_INTERVAL_MS);
    }

    void pollHealth();

    return () => {
      isActive = false;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      currentController?.abort();
    };
  }, [productionId]);

  return {
    status,
    buttonLabel:
      status === "ready"
        ? READY_LABEL
        : status === "unavailable"
          ? UNAVAILABLE_LABEL
          : STARTING_LABEL,
    isReady: status === "ready",
  };
}
