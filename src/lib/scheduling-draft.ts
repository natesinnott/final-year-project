import { isValidTimeZone } from "./availabilityTime.ts";
import {
  DEFAULT_ALLOWED_REHEARSAL_END_TIME,
  DEFAULT_ALLOWED_REHEARSAL_START_TIME,
  parseLocalTimeToMinutes,
} from "./scheduling.ts";

export type SchedulingDraftBlock = {
  clientId: string;
  label: string;
  durationMinutes: string;
  requiredPeopleIds: string[];
  predecessorBlockIds: string[];
};

export type SchedulingDraftState = {
  selectedTimeZone: string;
  horizonStart: string;
  horizonEnd: string;
  allowedStartTime: string;
  allowedEndTime: string;
  blocks: SchedulingDraftBlock[];
};

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  return [
    ...new Set(
      value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
    ),
  ];
}

function normalizeSchedulingDraftBlock(value: unknown): SchedulingDraftBlock | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    clientId?: unknown;
    label?: unknown;
    durationMinutes?: unknown;
    requiredPeopleIds?: unknown;
    predecessorBlockIds?: unknown;
  };

  if (
    typeof candidate.clientId !== "string" ||
    candidate.clientId.trim().length === 0 ||
    typeof candidate.label !== "string" ||
    typeof candidate.durationMinutes !== "string"
  ) {
    return null;
  }

  const requiredPeopleIds = normalizeStringArray(candidate.requiredPeopleIds);
  const predecessorBlockIds = normalizeStringArray(candidate.predecessorBlockIds);

  if (!requiredPeopleIds || !predecessorBlockIds) {
    return null;
  }

  return {
    clientId: candidate.clientId,
    label: candidate.label,
    durationMinutes: candidate.durationMinutes,
    requiredPeopleIds,
    predecessorBlockIds,
  };
}

export function normalizeSchedulingDraftState(
  value: unknown
): SchedulingDraftState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    selectedTimeZone?: unknown;
    horizonStart?: unknown;
    horizonEnd?: unknown;
    allowedStartTime?: unknown;
    allowedEndTime?: unknown;
    blocks?: unknown;
  };

  if (
    typeof candidate.selectedTimeZone !== "string" ||
    !isValidTimeZone(candidate.selectedTimeZone) ||
    typeof candidate.horizonStart !== "string" ||
    typeof candidate.horizonEnd !== "string" ||
    !Array.isArray(candidate.blocks)
  ) {
    return null;
  }

  const allowedStartTime =
    typeof candidate.allowedStartTime === "string"
      ? candidate.allowedStartTime
      : DEFAULT_ALLOWED_REHEARSAL_START_TIME;
  const allowedEndTime =
    typeof candidate.allowedEndTime === "string"
      ? candidate.allowedEndTime
      : DEFAULT_ALLOWED_REHEARSAL_END_TIME;

  const allowedStartMinutes = parseLocalTimeToMinutes(allowedStartTime);
  const allowedEndMinutes = parseLocalTimeToMinutes(allowedEndTime);

  if (
    allowedStartMinutes === null ||
    allowedEndMinutes === null ||
    allowedStartMinutes >= allowedEndMinutes
  ) {
    return null;
  }

  const blocks = candidate.blocks
    .map((block) => normalizeSchedulingDraftBlock(block))
    .filter((block): block is SchedulingDraftBlock => block !== null);

  if (blocks.length !== candidate.blocks.length) {
    return null;
  }

  return {
    selectedTimeZone: candidate.selectedTimeZone,
    horizonStart: candidate.horizonStart,
    horizonEnd: candidate.horizonEnd,
    allowedStartTime,
    allowedEndTime,
    blocks,
  };
}

export function buildSchedulingDraftSignature(
  draft: SchedulingDraftState | null
) {
  return JSON.stringify(draft);
}
