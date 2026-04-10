import { isValidTimeZone } from "@/lib/availabilityTime";

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
  blocks: SchedulingDraftBlock[];
};

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  return [...new Set(value)]
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
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
    blocks,
  };
}

export function buildSchedulingDraftSignature(
  draft: SchedulingDraftState | null
) {
  return JSON.stringify(draft);
}
