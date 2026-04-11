import type { TeamAvailabilityMember } from "./availability.ts";
import {
  isValidTimeZone,
  parseLocalDateTimeInput,
  zonedToUtc,
} from "./availabilityTime.ts";
import { buildAvailabilityFromConflicts } from "./conflictAvailability.ts";

export const SCHEDULER_TIME_GRANULARITY_MINUTES = 15;
export const DEFAULT_SCHEDULER_ROOM_ID = "default-room";
export const DEFAULT_SCHEDULER_ROOM_NAME = "Default room";
export const DEFAULT_ALLOWED_REHEARSAL_START_TIME = "08:00";
export const DEFAULT_ALLOWED_REHEARSAL_END_TIME = "23:30";

const LOCAL_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export type ScheduleBuilderBlock = {
  clientId: string;
  label: string;
  durationMinutes: number;
  requiredPeopleIds: string[];
  predecessorBlockIds: string[];
};

export type SolverPrecedence = {
  block_a: string;
  block_b: string;
};

export type SolverAllowedTimeWindow = {
  start_local_time: string;
  end_local_time: string;
};

export type SolverPayload = {
  horizon_start: string;
  horizon_end: string;
  time_zone: string;
  time_granularity_minutes: number;
  blocks: Array<{
    id: string;
    duration_minutes: number;
    required_people_ids: string[];
    fixed_room_id: string;
  }>;
  people: Array<{
    id: string;
    availability_windows: Array<{
      start: string;
      end: string;
    }>;
  }>;
  rooms: Array<{
    id: string;
    availability_windows: Array<{
      start: string;
      end: string;
    }>;
  }>;
  allowed_time_window: SolverAllowedTimeWindow;
  precedences: SolverPrecedence[];
};

function parseSchedulerLocalDateTime(value: string, timeZone: string) {
  const local = parseLocalDateTimeInput(value);

  if (!local) {
    return null;
  }

  return zonedToUtc(local, timeZone, { rejectNonexistent: true });
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function parseLocalTimeToMinutes(value: string) {
  if (!LOCAL_TIME_PATTERN.test(value)) {
    return null;
  }

  const [hours, minutes] = value.split(":");
  return Number.parseInt(hours ?? "0", 10) * 60 + Number.parseInt(minutes ?? "0", 10);
}

export function getDefaultAllowedTimeWindow(): SolverAllowedTimeWindow {
  return {
    start_local_time: DEFAULT_ALLOWED_REHEARSAL_START_TIME,
    end_local_time: DEFAULT_ALLOWED_REHEARSAL_END_TIME,
  };
}

export function validateAllowedTimeWindow({
  startLocalTime,
  endLocalTime,
}: {
  startLocalTime: string;
  endLocalTime: string;
}) {
  const errors: string[] = [];
  const startMinutes = parseLocalTimeToMinutes(startLocalTime);
  const endMinutes = parseLocalTimeToMinutes(endLocalTime);

  if (!startLocalTime) {
    errors.push("Choose an earliest rehearsal start time.");
  } else if (startMinutes === null) {
    errors.push("Earliest rehearsal start must use HH:MM.");
  }

  if (!endLocalTime) {
    errors.push("Choose a latest rehearsal end time.");
  } else if (endMinutes === null) {
    errors.push("Latest rehearsal end must use HH:MM.");
  }

  if (errors.length > 0) {
    return errors;
  }

  if (startMinutes! >= endMinutes!) {
    errors.push("Earliest rehearsal start must be earlier than latest rehearsal end.");
  }

  return errors;
}

export function normalizeAllowedTimeWindowInput(value: unknown): {
  allowedTimeWindow: SolverAllowedTimeWindow | null;
  error: string | null;
} {
  if (typeof value === "undefined") {
    return {
      allowedTimeWindow: getDefaultAllowedTimeWindow(),
      error: null,
    };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      allowedTimeWindow: null,
      error:
        "allowed_time_window must be an object with start_local_time and end_local_time.",
    };
  }

  const candidate = value as {
    start_local_time?: unknown;
    end_local_time?: unknown;
  };

  if (typeof candidate.start_local_time !== "string") {
    return {
      allowedTimeWindow: null,
      error: "allowed_time_window.start_local_time must use HH:MM.",
    };
  }

  if (typeof candidate.end_local_time !== "string") {
    return {
      allowedTimeWindow: null,
      error: "allowed_time_window.end_local_time must use HH:MM.",
    };
  }

  const startMinutes = parseLocalTimeToMinutes(candidate.start_local_time);
  if (startMinutes === null) {
    return {
      allowedTimeWindow: null,
      error: "allowed_time_window.start_local_time must use HH:MM.",
    };
  }

  const endMinutes = parseLocalTimeToMinutes(candidate.end_local_time);
  if (endMinutes === null) {
    return {
      allowedTimeWindow: null,
      error: "allowed_time_window.end_local_time must use HH:MM.",
    };
  }

  if (startMinutes >= endMinutes) {
    return {
      allowedTimeWindow: null,
      error:
        "allowed_time_window.start_local_time must be earlier than allowed_time_window.end_local_time.",
    };
  }

  return {
    allowedTimeWindow: {
      start_local_time: candidate.start_local_time,
      end_local_time: candidate.end_local_time,
    },
    error: null,
  };
}

export function normalizeSolverTimeZoneInput(value: unknown): {
  timeZone: string | null;
  error: string | null;
} {
  if (typeof value === "undefined") {
    return {
      timeZone: "UTC",
      error: null,
    };
  }

  if (typeof value !== "string") {
    return {
      timeZone: null,
      error: "time_zone must be a valid IANA time zone.",
    };
  }

  const trimmed = value.trim();
  if (!trimmed || !isValidTimeZone(trimmed)) {
    return {
      timeZone: null,
      error: "time_zone must be a valid IANA time zone.",
    };
  }

  return {
    timeZone: trimmed,
    error: null,
  };
}

export function buildSolverBlockId(block: Pick<ScheduleBuilderBlock, "clientId" | "label">) {
  const base = slugify(block.label) || "block";
  return `${base}-${block.clientId.slice(-6)}`;
}

function hasPath(
  adjacency: Map<string, Set<string>>,
  sourceId: string,
  targetId: string,
  visited = new Set<string>()
): boolean {
  if (sourceId === targetId) {
    return true;
  }

  if (visited.has(sourceId)) {
    return false;
  }

  visited.add(sourceId);
  const neighbors = adjacency.get(sourceId);

  if (!neighbors) {
    return false;
  }

  for (const nextId of neighbors) {
    if (hasPath(adjacency, nextId, targetId, visited)) {
      return true;
    }
  }

  return false;
}

export function validateSolverPrecedences({
  blockIds,
  precedences,
}: {
  blockIds: string[];
  precedences: SolverPrecedence[];
}) {
  const blockIdSet = new Set(blockIds);
  const errors: string[] = [];
  const adjacency = new Map<string, Set<string>>();

  for (const precedence of precedences) {
    if (!blockIdSet.has(precedence.block_a) || !blockIdSet.has(precedence.block_b)) {
      errors.push("Dependencies must reference known block ids.");
      continue;
    }

    if (precedence.block_a === precedence.block_b) {
      errors.push("A block cannot depend on itself.");
      continue;
    }

    if (hasPath(adjacency, precedence.block_b, precedence.block_a)) {
      errors.push("Dependencies cannot create a circular chain.");
      continue;
    }

    const existing = adjacency.get(precedence.block_a);
    if (existing) {
      existing.add(precedence.block_b);
    } else {
      adjacency.set(precedence.block_a, new Set([precedence.block_b]));
    }
  }

  return [...new Set(errors)];
}

export function wouldCreateDependencyCycle({
  edges,
  fromBlockId,
  toBlockId,
}: {
  edges: SolverPrecedence[];
  fromBlockId: string;
  toBlockId: string;
}) {
  if (fromBlockId === toBlockId) {
    return true;
  }

  const adjacency = new Map<string, Set<string>>();

  for (const edge of edges) {
    const existing = adjacency.get(edge.block_a);
    if (existing) {
      existing.add(edge.block_b);
    } else {
      adjacency.set(edge.block_a, new Set([edge.block_b]));
    }
  }

  return hasPath(adjacency, toBlockId, fromBlockId);
}

export function buildSolverPayload({
  horizonStart,
  horizonEnd,
  timeZone,
  allowedStartTime,
  allowedEndTime,
  blocks,
  members,
}: {
  horizonStart: string;
  horizonEnd: string;
  timeZone: string;
  allowedStartTime: string;
  allowedEndTime: string;
  blocks: ScheduleBuilderBlock[];
  members: TeamAvailabilityMember[];
}): SolverPayload | null {
  const parsedHorizonStart = parseSchedulerLocalDateTime(horizonStart, timeZone);
  const parsedHorizonEnd = parseSchedulerLocalDateTime(horizonEnd, timeZone);
  const allowedTimeWindowErrors = validateAllowedTimeWindow({
    startLocalTime: allowedStartTime,
    endLocalTime: allowedEndTime,
  });

  if (
    !parsedHorizonStart ||
    !parsedHorizonEnd ||
    parsedHorizonEnd <= parsedHorizonStart ||
    allowedTimeWindowErrors.length > 0
  ) {
    return null;
  }

  return {
    horizon_start: parsedHorizonStart.toISOString(),
    horizon_end: parsedHorizonEnd.toISOString(),
    time_zone: timeZone,
    time_granularity_minutes: SCHEDULER_TIME_GRANULARITY_MINUTES,
    blocks: blocks.map((block) => ({
      id: buildSolverBlockId(block),
      duration_minutes: block.durationMinutes,
      required_people_ids: block.requiredPeopleIds,
      fixed_room_id: DEFAULT_SCHEDULER_ROOM_ID,
    })),
    people: members.map((member) => ({
      id: member.userId,
      availability_windows: buildAvailabilityFromConflicts({
        conflicts: member.windows,
        horizonStart: parsedHorizonStart,
        horizonEnd: parsedHorizonEnd,
      }),
    })),
    rooms: [
      {
        id: DEFAULT_SCHEDULER_ROOM_ID,
        availability_windows: [
          {
            start: parsedHorizonStart.toISOString(),
            end: parsedHorizonEnd.toISOString(),
          },
        ],
      },
    ],
    allowed_time_window: {
      start_local_time: allowedStartTime,
      end_local_time: allowedEndTime,
    },
    precedences: blocks.flatMap((block) =>
      block.predecessorBlockIds.map((predecessorBlockId) => ({
        block_a: buildSolverBlockId({
          clientId: predecessorBlockId,
          label:
            blocks.find((candidate) => candidate.clientId === predecessorBlockId)?.label ??
            predecessorBlockId,
        }),
        block_b: buildSolverBlockId(block),
      }))
    ),
  };
}
