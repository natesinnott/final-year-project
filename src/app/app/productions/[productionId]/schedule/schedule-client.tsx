"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";
import type { TeamAvailabilityMember } from "@/lib/availability";
import {
  CURATED_TIME_ZONES,
  detectSystemTimeZone,
  isValidTimeZone,
  parseLocalDateTimeInput,
  utcToDateTimeInputValue,
  zonedToUtc,
} from "@/lib/availabilityTime";
import {
  buildSolverBlockId,
  buildSolverPayload,
  DEFAULT_ALLOWED_REHEARSAL_END_TIME,
  DEFAULT_ALLOWED_REHEARSAL_START_TIME,
  DEFAULT_SCHEDULER_ROOM_ID,
  DEFAULT_SCHEDULER_ROOM_NAME,
  SCHEDULER_TIME_GRANULARITY_MINUTES,
  validateAllowedTimeWindow,
  validateSolverPrecedences,
  wouldCreateDependencyCycle,
  type ScheduleBuilderBlock,
  type SolverPrecedence,
} from "@/lib/scheduling";
import {
  buildSchedulingDraftSignature,
  type SchedulingDraftBlock,
  type SchedulingDraftState,
} from "@/lib/scheduling-draft";
import { useSchedulerWarmup } from "@/lib/useSchedulerWarmup";
import { useBrowserDateTime } from "@/lib/useBrowserDateTime";

type ScheduleClientProps = {
  productionId: string;
  initialHorizonStart: string | null;
  initialHorizonEnd: string | null;
  initialTimeZone: string | null;
  initialMembers: TeamAvailabilityMember[];
  initialDraft: SchedulingDraftState | null;
  initialCompleteness: CompletenessPayload;
};

type BlockPlacement = {
  block_id?: string;
  blockId?: string;
  start?: string;
  end?: string;
  room_id?: string | null;
  roomId?: string | null;
};

type SolveResult = {
  status?: string;
  placements?: BlockPlacement[];
  objective_value?: number | null;
};

type MissingMember = {
  userId: string;
  name: string;
  role: string;
};

type CompletenessPayload = {
  is_complete: boolean;
  total_members: number;
  required_members: number;
  submitted_members: number;
  missing_members: MissingMember[];
};

type TeamPayload = {
  members: TeamAvailabilityMember[];
  completeness: CompletenessPayload;
};

type BlockDraft = SchedulingDraftBlock;

type SolvedPlanSnapshot = {
  horizonStart: string;
  horizonEnd: string;
  blocks: Array<{
    id: string;
    label: string;
    requiredPeopleIds: string[];
  }>;
};

const TERMINAL_JOB_STATES = new Set(["completed", "failed"]);
const SOLVER_RESULT_STATUSES = new Set([
  "OPTIMAL",
  "FEASIBLE",
  "INFEASIBLE",
  "TIME_LIMIT",
]);
const PUBLISHABLE_SOLVER_STATUSES = new Set(["OPTIMAL", "FEASIBLE"]);
const TIMEZONE_STORAGE_KEY = "stagesuite.schedule-timezone";
const DRAFT_SAVE_DEBOUNCE_MS = 800;

function generateClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `block-${Math.random().toString(36).slice(2, 10)}`;
}

function createEmptyBlock(): BlockDraft {
  return {
    clientId: generateClientId(),
    label: "",
    durationMinutes: "60",
    requiredPeopleIds: [],
    predecessorBlockIds: [],
  };
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const candidate = payload as { error?: unknown; detail?: unknown };

    if (typeof candidate.error === "string" && candidate.error.length > 0) {
      return candidate.error;
    }

    if (typeof candidate.detail === "string" && candidate.detail.length > 0) {
      return candidate.detail;
    }

    if (candidate.detail) {
      return JSON.stringify(candidate.detail);
    }
  }

  return fallback;
}

function extractSolveResult(payload: unknown): SolveResult | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const body = payload as {
    status?: unknown;
    placements?: unknown;
    result?: unknown;
  };

  if (
    typeof body.status === "string" &&
    SOLVER_RESULT_STATUSES.has(body.status) &&
    Array.isArray(body.placements)
  ) {
    return body as SolveResult;
  }

  if (!body.result || typeof body.result !== "object") {
    return null;
  }

  const result = body.result as {
    status?: unknown;
    placements?: unknown;
  };

  if (
    typeof result.status === "string" &&
    SOLVER_RESULT_STATUSES.has(result.status) &&
    Array.isArray(result.placements)
  ) {
    return result as SolveResult;
  }

  return null;
}

function formatDateTime(
  value: string | undefined,
  timeZone: string,
  formatInstant: (value: string | Date, timeZone: string) => string
) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return formatInstant(date, timeZone);
}

function toDateTimeInputValue(value: string | null, timeZone: string) {
  return utcToDateTimeInputValue(value, timeZone);
}

function roundUpToQuarterHour(date: Date) {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);

  const minutes = rounded.getMinutes();
  const remainder = minutes % SCHEDULER_TIME_GRANULARITY_MINUTES;

  if (remainder !== 0) {
    rounded.setMinutes(
      minutes + (SCHEDULER_TIME_GRANULARITY_MINUTES - remainder),
      0,
      0
    );
  }

  return rounded;
}

function getFallbackHorizonValues(timeZone: string) {
  const start = roundUpToQuarterHour(new Date());
  const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);

  return {
    start: utcToDateTimeInputValue(start.toISOString(), timeZone),
    end: utcToDateTimeInputValue(end.toISOString(), timeZone),
  };
}

function parseSchedulerDateTime(value: string, timeZone: string) {
  const local = parseLocalDateTimeInput(value);

  if (!local) {
    return null;
  }

  return {
    local,
    utc: zonedToUtc(local, timeZone, { rejectNonexistent: true }),
  };
}

function convertDateTimeInputValue(
  value: string,
  fromTimeZone: string,
  toTimeZone: string
) {
  const parsed = parseSchedulerDateTime(value, fromTimeZone);

  if (!parsed?.utc) {
    return "";
  }

  return utcToDateTimeInputValue(parsed.utc, toTimeZone);
}

function parseResponseJson(response: Response) {
  return response.text().then((text) => {
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      return { raw: text };
    }
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function validateHorizon(
  horizonStart: string,
  horizonEnd: string,
  timeZone: string
) {
  const errors: string[] = [];
  const start = parseSchedulerDateTime(horizonStart, timeZone);
  const end = parseSchedulerDateTime(horizonEnd, timeZone);

  if (!horizonStart || !start?.utc) {
    errors.push("Choose a valid horizon start date and time.");
  }

  if (!horizonEnd || !end?.utc) {
    errors.push("Choose a valid horizon end date and time.");
  }

  if (errors.length > 0) {
    return errors;
  }

  const startValue = start!;
  const endValue = end!;

  if (endValue.utc! <= startValue.utc!) {
    errors.push("Horizon end must be after the horizon start.");
  }

  if (
    startValue.local.minute % SCHEDULER_TIME_GRANULARITY_MINUTES !== 0 ||
    endValue.local.minute % SCHEDULER_TIME_GRANULARITY_MINUTES !== 0
  ) {
    errors.push(
      `Horizon times must align to ${SCHEDULER_TIME_GRANULARITY_MINUTES}-minute increments.`
    );
  }

  return errors;
}

function validateBlock(block: BlockDraft) {
  const errors: string[] = [];
  const duration = Number(block.durationMinutes);

  if (block.label.trim().length === 0) {
    errors.push("Enter a block label.");
  }

  if (!Number.isFinite(duration) || !Number.isInteger(duration) || duration <= 0) {
    errors.push("Duration must be a whole number greater than 0.");
  } else if (duration % SCHEDULER_TIME_GRANULARITY_MINUTES !== 0) {
    errors.push(
      `Duration must be a multiple of ${SCHEDULER_TIME_GRANULARITY_MINUTES} minutes.`
    );
  }

  if (block.requiredPeopleIds.length === 0) {
    errors.push("Select at least one required person.");
  }

  return errors;
}

function normalizeBlock(block: BlockDraft): ScheduleBuilderBlock {
  return {
    clientId: block.clientId,
    label: block.label.trim(),
    durationMinutes: Number(block.durationMinutes),
    requiredPeopleIds: block.requiredPeopleIds,
    predecessorBlockIds: block.predecessorBlockIds,
  };
}

function buildDraftPrecedences(blocks: BlockDraft[]): SolverPrecedence[] {
  return blocks.flatMap((block) =>
    block.predecessorBlockIds.map((predecessorBlockId) => ({
      block_a: predecessorBlockId,
      block_b: block.clientId,
    }))
  );
}

function buildSolvedPlanSnapshot(
  payload: ReturnType<typeof buildSolverPayload>,
  blocks: ScheduleBuilderBlock[]
): SolvedPlanSnapshot | null {
  if (!payload) {
    return null;
  }

  return {
    horizonStart: payload.horizon_start,
    horizonEnd: payload.horizon_end,
    blocks: blocks.map((block) => ({
      id: buildSolverBlockId(block),
      label: block.label,
      requiredPeopleIds: block.requiredPeopleIds,
    })),
  };
}

export default function ScheduleClient({
  productionId,
  initialHorizonStart,
  initialHorizonEnd,
  initialTimeZone,
  initialMembers,
  initialDraft,
  initialCompleteness,
}: ScheduleClientProps) {
  const dateTime = useBrowserDateTime();
  const schedulerWarmup = useSchedulerWarmup(productionId);
  const detectedTimeZone = useMemo(() => detectSystemTimeZone(), []);
  const hasLockedTimeZone = Boolean(
    initialTimeZone && isValidTimeZone(initialTimeZone)
  );
  const [selectedTimeZone, setSelectedTimeZone] = useState(() =>
    hasLockedTimeZone && initialTimeZone
      ? initialTimeZone
      : initialDraft?.selectedTimeZone ?? "UTC"
  );
  const [timeZoneReady, setTimeZoneReady] = useState(
    hasLockedTimeZone || Boolean(initialDraft?.selectedTimeZone)
  );
  const timezoneOptions = useMemo(() => {
    return Array.from(new Set([detectedTimeZone, "UTC", ...CURATED_TIME_ZONES]));
  }, [detectedTimeZone]);

  const [members, setMembers] = useState(initialMembers);

  const [completenessLoading, setCompletenessLoading] = useState(false);
  const [completenessError, setCompletenessError] = useState<string | null>(null);
  const [completeness, setCompleteness] = useState(initialCompleteness);

  const [horizonStart, setHorizonStart] = useState(initialDraft?.horizonStart ?? "");
  const [horizonEnd, setHorizonEnd] = useState(initialDraft?.horizonEnd ?? "");
  const [allowedStartTime, setAllowedStartTime] = useState(
    initialDraft?.allowedStartTime ?? DEFAULT_ALLOWED_REHEARSAL_START_TIME
  );
  const [allowedEndTime, setAllowedEndTime] = useState(
    initialDraft?.allowedEndTime ?? DEFAULT_ALLOWED_REHEARSAL_END_TIME
  );
  const [blocks, setBlocks] = useState<BlockDraft[]>(
    initialDraft?.blocks ?? [createEmptyBlock()]
  );
  const [hasUserEditedDraft, setHasUserEditedDraft] = useState(false);
  const [lastPersistedDraftSignature, setLastPersistedDraftSignature] = useState(() =>
    buildSchedulingDraftSignature(initialDraft)
  );

  const [isRunning, setIsRunning] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [lastHttpStatus, setLastHttpStatus] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<unknown>(null);
  const [solveResult, setSolveResult] = useState<SolveResult | null>(null);
  const [solvedPlanSnapshot, setSolvedPlanSnapshot] = useState<SolvedPlanSnapshot | null>(
    null
  );

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

  useEffect(() => {
    if (hasLockedTimeZone && initialTimeZone) {
      setSelectedTimeZone(initialTimeZone);
      setTimeZoneReady(true);
      return;
    }

    if (initialDraft?.selectedTimeZone) {
      setSelectedTimeZone(initialDraft.selectedTimeZone);
      setTimeZoneReady(true);
      return;
    }

    const fromStorage =
      typeof window !== "undefined"
        ? window.localStorage.getItem(TIMEZONE_STORAGE_KEY)
        : null;
    const candidate =
      fromStorage && isValidTimeZone(fromStorage) ? fromStorage : detectedTimeZone;

    setSelectedTimeZone(candidate);
    setTimeZoneReady(true);
  }, [detectedTimeZone, hasLockedTimeZone, initialDraft?.selectedTimeZone, initialTimeZone]);

  useEffect(() => {
    if (!timeZoneReady) {
      return;
    }

    const fallback = getFallbackHorizonValues(selectedTimeZone);
    setHorizonStart((current) => {
      if (current) {
        return current;
      }

      return toDateTimeInputValue(initialHorizonStart, selectedTimeZone) || fallback.start;
    });
    setHorizonEnd((current) => {
      if (current) {
        return current;
      }

      return toDateTimeInputValue(initialHorizonEnd, selectedTimeZone) || fallback.end;
    });
  }, [initialHorizonEnd, initialHorizonStart, selectedTimeZone, timeZoneReady]);

  useEffect(() => {
    if (
      hasLockedTimeZone ||
      !timeZoneReady ||
      typeof window === "undefined"
    ) {
      return;
    }

    window.localStorage.setItem(TIMEZONE_STORAGE_KEY, selectedTimeZone);
  }, [hasLockedTimeZone, selectedTimeZone, timeZoneReady]);

  const loadScheduleData = useCallback(async () => {
    setCompletenessLoading(true);
    setCompletenessError(null);

    try {
      const response = await fetch(
        `/api/productions/${encodeURIComponent(productionId)}/availability/team`,
        { cache: "no-store" }
      );
      const body = (await parseResponseJson(response)) as
        | (TeamPayload & { error?: string })
        | null;

      if (!response.ok) {
        throw new Error(getErrorMessage(body, "Failed to load production conflicts."));
      }

      setMembers(body?.members ?? []);
      setCompleteness(
        body?.completeness ?? {
          is_complete: false,
          total_members: 0,
          required_members: 0,
          submitted_members: 0,
          missing_members: [],
        }
      );
    } catch (error) {
      setCompletenessError(
        error instanceof Error ? error.message : "Failed to load production conflicts."
      );
    } finally {
      setCompletenessLoading(false);
    }
  }, [productionId]);

  useEffect(() => {
    loadScheduleData();
  }, [loadScheduleData]);

  const persistDraft = useCallback(
    async (draft: SchedulingDraftState, keepalive = false) => {
      const response = await fetch(
        `/api/productions/${encodeURIComponent(productionId)}/schedule-draft`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(draft),
          keepalive,
        }
      );
      const body = await parseResponseJson(response);

      if (!response.ok) {
        throw new Error(getErrorMessage(body, "Unable to save scheduling draft."));
      }
    },
    [productionId]
  );

  async function pollJobUntilComplete(currentJobId: string) {
    const maxAttempts = 30;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await fetch(
        `/api/scheduler/jobs/${encodeURIComponent(currentJobId)}?productionId=${encodeURIComponent(productionId)}`,
        { cache: "no-store" }
      );

      const body = await parseResponseJson(response);
      setLastHttpStatus(response.status);
      setLastResponse(body);

      if (!response.ok) {
        throw new Error(getErrorMessage(body, "Unable to retrieve solver job status."));
      }

      if (body && typeof body === "object") {
        const status = (body as { status?: unknown }).status;

        if (typeof status === "string") {
          setJobStatus(status);

          if (TERMINAL_JOB_STATES.has(status)) {
            if (status === "failed") {
              throw new Error(getErrorMessage(body, "Scheduler job failed."));
            }

            const result = extractSolveResult(body);
            if (!result) {
              throw new Error("Scheduler finished without a valid result payload.");
            }

            setSolveResult(result);
            return;
          }
        }
      }

      await sleep(1000);
    }

    throw new Error("Solver job polling timed out.");
  }

  const horizonErrors = useMemo(
    () => validateHorizon(horizonStart, horizonEnd, selectedTimeZone),
    [horizonEnd, horizonStart, selectedTimeZone]
  );
  const allowedTimeWindowErrors = useMemo(
    () =>
      validateAllowedTimeWindow({
        startLocalTime: allowedStartTime,
        endLocalTime: allowedEndTime,
      }),
    [allowedEndTime, allowedStartTime]
  );
  const blockErrors = useMemo(
    () =>
      Object.fromEntries(blocks.map((block) => [block.clientId, validateBlock(block)])) as Record<
        string,
        string[]
      >,
    [blocks]
  );
  const draftPrecedences = useMemo(() => buildDraftPrecedences(blocks), [blocks]);
  const dependencyErrors = useMemo(
    () =>
      validateSolverPrecedences({
        blockIds: blocks.map((block) => block.clientId),
        precedences: draftPrecedences,
      }),
    [blocks, draftPrecedences]
  );
  const normalizedBlocks = useMemo(
    () => blocks.map((block) => normalizeBlock(block)),
    [blocks]
  );
  const hasInvalidBlocks = blocks.some(
    (block) => (blockErrors[block.clientId] ?? []).length > 0
  );
  const hasNoBlocks = blocks.length === 0;
  const isFormValid =
    horizonErrors.length === 0 &&
    allowedTimeWindowErrors.length === 0 &&
    dependencyErrors.length === 0 &&
    !hasNoBlocks &&
    !hasInvalidBlocks;
  const generatedPayload = useMemo(
    () =>
      isFormValid
        ? buildSolverPayload({
            horizonStart,
            horizonEnd,
            timeZone: selectedTimeZone,
            allowedStartTime,
            allowedEndTime,
            blocks: normalizedBlocks,
            members,
          })
        : null,
    [
      allowedEndTime,
      allowedStartTime,
      horizonEnd,
      horizonStart,
      isFormValid,
      members,
      normalizedBlocks,
      selectedTimeZone,
    ]
  );
  const placements = useMemo(() => solveResult?.placements ?? [], [solveResult]);
  const placementCount = placements.length;
  const solvedBlockLabelMap = useMemo(
    () =>
      Object.fromEntries(
        (solvedPlanSnapshot?.blocks ?? []).map((block) => [block.id, block.label])
      ),
    [solvedPlanSnapshot]
  );
  const currentDraft = useMemo<SchedulingDraftState | null>(
    () =>
      timeZoneReady
        ? {
            selectedTimeZone,
            horizonStart,
            horizonEnd,
            allowedStartTime,
            allowedEndTime,
            blocks,
          }
        : null,
    [
      allowedEndTime,
      allowedStartTime,
      blocks,
      horizonEnd,
      horizonStart,
      selectedTimeZone,
      timeZoneReady,
    ]
  );
  const currentDraftSignature = useMemo(
    () => buildSchedulingDraftSignature(currentDraft),
    [currentDraft]
  );
  const canPublish =
    timeZoneReady &&
    !isPublishing &&
    Boolean(solvedPlanSnapshot) &&
    Boolean(solveResult?.status && PUBLISHABLE_SOLVER_STATUSES.has(solveResult.status)) &&
    placementCount > 0;
  const solveBlocked =
    !schedulerWarmup.isReady ||
    !timeZoneReady ||
    isRunning ||
    completenessLoading ||
    !completeness.is_complete ||
    !isFormValid ||
    !generatedPayload;
  const flushDraftOnPageHide = useEffectEvent(() => {
    if (
      !timeZoneReady ||
      !currentDraft ||
      !hasUserEditedDraft ||
      currentDraftSignature === lastPersistedDraftSignature
    ) {
      return;
    }

    void persistDraft(currentDraft, true).catch(() => {
      // Ignore pagehide persistence failures so navigation still completes.
    });
  });

  useEffect(() => {
    if (
      !timeZoneReady ||
      !currentDraft ||
      !hasUserEditedDraft ||
      currentDraftSignature === lastPersistedDraftSignature
    ) {
      return;
    }

    let isActive = true;
    const draftToPersist = currentDraft;
    const timeoutId = window.setTimeout(() => {
      void persistDraft(draftToPersist)
        .then(() => {
          if (isActive) {
            setLastPersistedDraftSignature(currentDraftSignature);
          }
        })
        .catch((error) => {
          if (isActive) {
            console.error("Unable to save scheduling draft.", error);
          }
        });
    }, DRAFT_SAVE_DEBOUNCE_MS);

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [
    currentDraft,
    currentDraftSignature,
    hasUserEditedDraft,
    lastPersistedDraftSignature,
    persistDraft,
    timeZoneReady,
  ]);

  useEffect(() => {
    window.addEventListener("pagehide", flushDraftOnPageHide);

    return () => {
      window.removeEventListener("pagehide", flushDraftOnPageHide);
    };
  }, []);

  async function handleRunSolve() {
    setIsRunning(true);
    setIsPublishing(false);
    setErrorMessage(null);
    setPublishMessage(null);
    setLastHttpStatus(null);
    setLastResponse(null);
    setSolveResult(null);
    setSolvedPlanSnapshot(null);
    setJobId(null);
    setJobStatus(null);

    if (completenessLoading) {
      setErrorMessage("Conflict submission status is still loading.");
      setIsRunning(false);
      return;
    }

    if (!completeness.is_complete) {
      setErrorMessage(
        "Scheduling is blocked until all required members review and submit conflicts."
      );
      setIsRunning(false);
      return;
    }

    if (!generatedPayload) {
      setErrorMessage(
        "Resolve the horizon, rehearsal-hour, block, and dependency validation errors first."
      );
      setIsRunning(false);
      return;
    }

    const solvedSnapshot = buildSolvedPlanSnapshot(generatedPayload, normalizedBlocks);

    try {
      const response = await fetch(
        `/api/scheduler/solve?productionId=${encodeURIComponent(productionId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(generatedPayload),
        }
      );

      const body = await parseResponseJson(response);
      setLastHttpStatus(response.status);
      setLastResponse(body);

      if (response.status === 409 && body && typeof body === "object") {
        const conflictBody = body as {
          missing_members?: MissingMember[];
          total_members?: number;
          required_members?: number;
          submitted_members?: number;
        };

        setCompleteness((prev) => ({
          is_complete: false,
          total_members: conflictBody.total_members ?? prev.total_members,
          required_members: conflictBody.required_members ?? prev.required_members,
          submitted_members: conflictBody.submitted_members ?? prev.submitted_members,
          missing_members: conflictBody.missing_members ?? prev.missing_members,
        }));
      }

      if (!response.ok) {
        setErrorMessage(getErrorMessage(body, "Solver request failed."));
        return;
      }

      setSolvedPlanSnapshot(solvedSnapshot);

      const immediateResult = extractSolveResult(body);
      if (immediateResult) {
        setSolveResult(immediateResult);
        return;
      }

      if (body && typeof body === "object") {
        const solveBody = body as { job_id?: unknown; status?: unknown };

        if (typeof solveBody.job_id === "string" && solveBody.job_id.length > 0) {
          setJobId(solveBody.job_id);
          if (typeof solveBody.status === "string") {
            setJobStatus(solveBody.status);
          }
          await pollJobUntilComplete(solveBody.job_id);
          return;
        }
      }

      setErrorMessage("Solver response did not include a usable result.");
      setSolvedPlanSnapshot(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unexpected scheduling error."
      );
      setSolvedPlanSnapshot(null);
    } finally {
      setIsRunning(false);
      loadScheduleData();
    }
  }

  async function handlePublishRehearsals() {
    if (!solvedPlanSnapshot || !solveResult?.status || !PUBLISHABLE_SOLVER_STATUSES.has(solveResult.status)) {
      setPublishMessage(null);
      setErrorMessage("Run a feasible solve before publishing rehearsals.");
      return;
    }

    if (
      typeof window !== "undefined" &&
      !window.confirm(
        hasLockedTimeZone
          ? `Published rehearsals will continue using ${selectedTimeZone}. Continue?`
          : `Publishing will permanently lock this production to ${selectedTimeZone} until the future schedule is discarded and regenerated. Continue?`
      )
    ) {
      return;
    }

    setIsPublishing(true);
    setErrorMessage(null);
    setPublishMessage(null);

    try {
      const response = await fetch(
        `/api/productions/${encodeURIComponent(productionId)}/rehearsals/publish`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            horizon_start: solvedPlanSnapshot.horizonStart,
            horizon_end: solvedPlanSnapshot.horizonEnd,
            time_zone: selectedTimeZone,
            solve_run_id: jobId,
            solver_status: solveResult.status,
            blocks: solvedPlanSnapshot.blocks.map((block) => ({
              id: block.id,
              label: block.label,
              required_people_ids: block.requiredPeopleIds,
            })),
            placements,
          }),
        }
      );

      const body = await parseResponseJson(response);
      if (!response.ok) {
        throw new Error(getErrorMessage(body, "Unable to publish rehearsals."));
      }

      const createdCount =
        body && typeof body === "object" && typeof (body as { created_count?: unknown }).created_count === "number"
          ? (body as { created_count: number }).created_count
          : 0;

      setPublishMessage(
        createdCount === 1
          ? "Published 1 rehearsal."
          : `Published ${createdCount} rehearsals.`
      );
      setHasUserEditedDraft(false);
      setLastPersistedDraftSignature(buildSchedulingDraftSignature(null));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unexpected publish error."
      );
    } finally {
      setIsPublishing(false);
    }
  }

  function markDraftEdited() {
    setHasUserEditedDraft(true);
  }

  function updateBlock(clientId: string, updates: Partial<BlockDraft>) {
    markDraftEdited();
    setBlocks((current) =>
      current.map((block) =>
        block.clientId === clientId ? { ...block, ...updates } : block
      )
    );
  }

  function toggleRequiredPerson(clientId: string, userId: string) {
    markDraftEdited();
    setBlocks((current) =>
      current.map((block) => {
        if (block.clientId !== clientId) {
          return block;
        }

        return {
          ...block,
          requiredPeopleIds: block.requiredPeopleIds.includes(userId)
            ? block.requiredPeopleIds.filter((id) => id !== userId)
            : [...block.requiredPeopleIds, userId],
        };
      })
    );
  }

  function togglePredecessor(clientId: string, predecessorBlockId: string) {
    markDraftEdited();
    setBlocks((current) =>
      current.map((block) => {
        if (block.clientId !== clientId) {
          return block;
        }

        return {
          ...block,
          predecessorBlockIds: block.predecessorBlockIds.includes(predecessorBlockId)
            ? block.predecessorBlockIds.filter((id) => id !== predecessorBlockId)
            : [...block.predecessorBlockIds, predecessorBlockId],
        };
      })
    );
  }

  function deleteBlock(clientId: string) {
    markDraftEdited();
    setBlocks((current) =>
      current
        .filter((block) => block.clientId !== clientId)
        .map((block) => ({
          ...block,
          predecessorBlockIds: block.predecessorBlockIds.filter((id) => id !== clientId),
        }))
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Schedule workspace
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Build and publish schedules
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
              onClick={handleRunSolve}
              disabled={solveBlocked}
            >
              {schedulerWarmup.buttonLabel}
            </button>
            <button
              className="rounded-xl border border-emerald-400/60 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-60"
              onClick={handlePublishRehearsals}
              disabled={!canPublish}
            >
              {isPublishing ? "Publishing..." : "Publish rehearsals"}
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span
            className={`rounded-full border px-3 py-1 ${
              completeness.is_complete
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                : "border-rose-500/40 bg-rose-500/10 text-rose-100"
            }`}
          >
            {completeness.is_complete ? "Conflicts complete" : "Conflicts incomplete"}
          </span>
          <span className="rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1 text-slate-300">
            Blocks: {blocks.length}
          </span>
          <span className="rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1 text-slate-300">
            Placements: {placementCount}
          </span>
          <span className="rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1 text-slate-300">
            Solver status: {solveResult?.status ?? "-"}
          </span>
        </div>

        {publishMessage ? (
          <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {publishMessage}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {errorMessage}
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_0.95fr]">
        <div className="grid gap-6">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Horizon
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">Scheduling window</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-[1.1fr_1.9fr]">
              <label className="grid gap-2 text-sm text-slate-300">
                <span className="font-medium text-white">Scheduling time zone</span>
                <select
                  className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-amber-300 disabled:opacity-70"
                  value={selectedTimeZone}
                  disabled={hasLockedTimeZone}
                  onChange={(event) => {
                    markDraftEdited();
                    const nextTimeZone = event.target.value;
                    setHorizonStart((current) =>
                      current
                        ? convertDateTimeInputValue(
                            current,
                            selectedTimeZone,
                            nextTimeZone
                          ) || current
                        : current
                    );
                    setHorizonEnd((current) =>
                      current
                        ? convertDateTimeInputValue(
                            current,
                            selectedTimeZone,
                            nextTimeZone
                          ) || current
                        : current
                    );
                    setSelectedTimeZone(nextTimeZone);
                  }}
                >
                  <option value={detectedTimeZone}>
                    Local (Detected) · {detectedTimeZone}
                  </option>
                  {timezoneOptions.map((timeZone) => (
                    <option key={timeZone} value={timeZone}>
                      {timeZone}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-300">
                <span className="font-medium text-white">Horizon start</span>
                <input
                  type="datetime-local"
                  step={SCHEDULER_TIME_GRANULARITY_MINUTES * 60}
                  className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-amber-300"
                  value={horizonStart}
                  disabled={!timeZoneReady}
                  onChange={(event) => {
                    markDraftEdited();
                    setHorizonStart(event.target.value);
                  }}
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-300">
                <span className="font-medium text-white">Horizon end</span>
                <input
                  type="datetime-local"
                  step={SCHEDULER_TIME_GRANULARITY_MINUTES * 60}
                  className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-amber-300"
                  value={horizonEnd}
                  disabled={!timeZoneReady}
                  onChange={(event) => {
                    markDraftEdited();
                    setHorizonEnd(event.target.value);
                  }}
                />
              </label>
            </div>

            <div className="mt-4 grid gap-2">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm text-slate-300">
                  <span className="font-medium text-white">Earliest rehearsal start</span>
                  <input
                    type="time"
                    step={SCHEDULER_TIME_GRANULARITY_MINUTES * 60}
                    required
                    className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-amber-300"
                    value={allowedStartTime}
                    onChange={(event) => {
                      markDraftEdited();
                      setAllowedStartTime(event.target.value);
                    }}
                  />
                </label>
                <label className="grid gap-2 text-sm text-slate-300">
                  <span className="font-medium text-white">Latest rehearsal end</span>
                  <input
                    type="time"
                    step={SCHEDULER_TIME_GRANULARITY_MINUTES * 60}
                    required
                    className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-amber-300"
                    value={allowedEndTime}
                    onChange={(event) => {
                      markDraftEdited();
                      setAllowedEndTime(event.target.value);
                    }}
                  />
                </label>
              </div>
            </div>

            {horizonErrors.length > 0 ? (
              <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {horizonErrors.join(" ")}
              </div>
            ) : null}

            {allowedTimeWindowErrors.length > 0 ? (
              <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {allowedTimeWindowErrors.join(" ")}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Block builder
                </p>
                <h3 className="mt-2 text-lg font-semibold text-white">
                  Rehearsal blocks and dependencies
                </h3>
              </div>
              <button
                className="rounded-xl border border-amber-300/60 px-4 py-2 text-sm font-semibold text-amber-100 hover:border-amber-200"
                onClick={() => {
                  markDraftEdited();
                  setBlocks((current) => [...current, createEmptyBlock()]);
                }}
              >
                Add block
              </button>
            </div>

            {dependencyErrors.length > 0 ? (
              <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {dependencyErrors.join(" ")}
              </div>
            ) : null}

            {hasNoBlocks ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
                Add a block to run the solver.
              </div>
            ) : (
              <div className="mt-4 grid gap-4">
                {blocks.map((block, index) => {
                  const errors = blockErrors[block.clientId] ?? [];
                  const otherBlocks = blocks.filter(
                    (candidate) => candidate.clientId !== block.clientId
                  );

                  return (
                    <article
                      key={block.clientId}
                      className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Block {index + 1}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            Solver id: {buildSolverBlockId(normalizeBlock(block))}
                          </p>
                        </div>
                        <button
                          className="rounded-lg border border-rose-500/60 px-3 py-1 text-xs font-semibold text-rose-200 hover:border-rose-400"
                          onClick={() => deleteBlock(block.clientId)}
                        >
                          Delete
                        </button>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-[1.6fr_0.7fr]">
                        <label className="grid gap-2 text-sm text-slate-300">
                          <span className="font-medium text-white">Block label</span>
                          <input
                            type="text"
                            className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-amber-300"
                            placeholder="Act 1 Scene 2"
                            value={block.label}
                            onChange={(event) =>
                              updateBlock(block.clientId, { label: event.target.value })
                            }
                          />
                        </label>
                        <label className="grid gap-2 text-sm text-slate-300">
                          <span className="font-medium text-white">Duration (minutes)</span>
                          <input
                            type="number"
                            min={SCHEDULER_TIME_GRANULARITY_MINUTES}
                            step={SCHEDULER_TIME_GRANULARITY_MINUTES}
                            className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-amber-300"
                            value={block.durationMinutes}
                            onChange={(event) =>
                              updateBlock(block.clientId, {
                                durationMinutes: event.target.value,
                              })
                            }
                          />
                        </label>
                      </div>

                      <div className="mt-4 grid gap-4 xl:grid-cols-2">
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h4 className="text-sm font-medium text-white">Required people</h4>
                              <p className="text-xs text-slate-400">Required for this block.</p>
                            </div>
                            <span className="text-xs text-slate-400">
                              Selected: {block.requiredPeopleIds.length}
                            </span>
                          </div>

                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {members.map((member) => (
                              <label
                                key={`${block.clientId}-${member.userId}`}
                                className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3 text-sm text-slate-200"
                              >
                                <input
                                  type="checkbox"
                                  className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-300"
                                  checked={block.requiredPeopleIds.includes(member.userId)}
                                  onChange={() => toggleRequiredPerson(block.clientId, member.userId)}
                                />
                                <span>
                                  <span className="block font-medium text-white">{member.name}</span>
                                  <span className="block text-xs text-slate-400">{member.role}</span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h4 className="text-sm font-medium text-white">Dependencies</h4>
                              <p className="text-xs text-slate-400">Must finish first.</p>
                            </div>
                            <span className="text-xs text-slate-400">
                              Selected: {block.predecessorBlockIds.length}
                            </span>
                          </div>

                          {otherBlocks.length === 0 ? (
                            <div className="mt-3 rounded-xl border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-400">
                              Add another block.
                            </div>
                          ) : (
                            <div className="mt-3 grid gap-2">
                              {otherBlocks.map((candidate, candidateIndex) => {
                                const candidateLabel =
                                  candidate.label.trim() || `Block ${candidateIndex + 1}`;
                                const isChecked = block.predecessorBlockIds.includes(
                                  candidate.clientId
                                );
                                const isDisabled =
                                  !isChecked &&
                                  wouldCreateDependencyCycle({
                                    edges: draftPrecedences,
                                    fromBlockId: candidate.clientId,
                                    toBlockId: block.clientId,
                                  });

                                return (
                                  <label
                                    key={`${block.clientId}-${candidate.clientId}-dependency`}
                                    className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-sm ${
                                      isDisabled
                                        ? "border-slate-800 bg-slate-950/30 text-slate-500"
                                        : "border-slate-800 bg-slate-950/60 text-slate-200"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-amber-300"
                                      checked={isChecked}
                                      disabled={isDisabled}
                                      onChange={() =>
                                        togglePredecessor(block.clientId, candidate.clientId)
                                      }
                                    />
                                    <span>
                                      <span className="block font-medium text-white">
                                        {candidateLabel}
                                      </span>
                                      <span className="block text-xs text-slate-400">
                                        Must finish before this block starts
                                      </span>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {errors.length > 0 ? (
                        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                          {errors.join(" ")}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="grid gap-6">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Readiness
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">Conflict status</h3>

            <div className="mt-4 grid gap-3 text-sm text-slate-300">
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                Total members: <span className="text-white">{completeness.total_members}</span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                Required: <span className="text-white">{completeness.required_members}</span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                Submitted: <span className="text-white">{completeness.submitted_members}</span>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                Missing: <span className="text-white">{completeness.missing_members.length}</span>
              </div>
            </div>

            {completenessError ? (
              <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {completenessError}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Missing conflict submissions
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">Blocking members</h3>

            {completeness.missing_members.length === 0 ? (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                All conflicts submitted
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4">
                <ul className="space-y-1 text-sm text-rose-100/90">
                  {completeness.missing_members.map((member) => (
                    <li key={member.userId}>
                      {member.name} ({member.role})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Execution
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">Latest run</h3>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <p>
                Last HTTP status: <span className="text-white">{lastHttpStatus ?? "-"}</span>
              </p>
              <p>
                Job id: <span className="text-white">{jobId ?? "-"}</span>
              </p>
              <p>
                Job status: <span className="text-white">{jobStatus ?? "-"}</span>
              </p>
              <p>
                Solver status: <span className="text-white">{solveResult?.status ?? "-"}</span>
              </p>
            </div>
          </section>
        </aside>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Proposed schedule
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">Solver results</h3>
          </div>
          {canPublish ? (
            <button
              className="rounded-xl border border-emerald-400/60 px-4 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-60"
              onClick={handlePublishRehearsals}
              disabled={isPublishing}
            >
              {isPublishing ? "Publishing..." : "Publish rehearsals"}
            </button>
          ) : null}
        </div>

        {solveResult ? (
          <>
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
              Solver status: <span className="font-semibold text-white">{solveResult.status}</span>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
              <div className="grid grid-cols-[1.1fr_1fr_1fr_0.7fr] gap-3 border-b border-slate-800 bg-slate-950/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                <div>Block</div>
                <div>Start</div>
                <div>End</div>
                <div>Room</div>
              </div>
              {placements.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-300">No placements</div>
              ) : (
                placements.map((placement, index) => {
                  const blockId = placement.block_id ?? placement.blockId ?? "-";
                  const roomId = placement.room_id ?? placement.roomId ?? null;

                  return (
                    <div
                      key={`${blockId}-${index}`}
                      className="grid grid-cols-[1.1fr_1fr_1fr_0.7fr] gap-3 border-b border-slate-800 px-4 py-3 text-sm text-slate-200"
                    >
                      <div>{solvedBlockLabelMap[blockId] ?? blockId}</div>
                      <div>{formatDateTime(placement.start, selectedTimeZone, dateTime.formatInstant)}</div>
                      <div>{formatDateTime(placement.end, selectedTimeZone, dateTime.formatInstant)}</div>
                      <div>
                        {roomId === DEFAULT_SCHEDULER_ROOM_ID
                          ? DEFAULT_SCHEDULER_ROOM_NAME
                          : roomId ?? "-"}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-slate-700 px-4 py-6 text-sm text-slate-400">
            No schedule generated
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm">
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-slate-200">
            Debug JSON
          </summary>
          <div className="mt-4 grid gap-4">
            <div>
              <h4 className="text-sm font-semibold text-white">Generated solver payload</h4>
              <pre className="mt-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-300">
                {JSON.stringify(generatedPayload, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Raw solver response</h4>
              <pre className="mt-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-300">
                {JSON.stringify(lastResponse, null, 2)}
              </pre>
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
