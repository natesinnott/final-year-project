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

export const DEFAULT_SOLVER_PAYLOAD_LIMITS = {
  maxBlocks: 500,
  maxPeople: 250,
  maxRooms: 50,
  maxAvailabilityWindows: 10_000,
  maxPrecedences: 5_000,
  maxRequiredPeoplePerBlock: 250,
  maxTotalRequiredPeopleReferences: 20_000,
  maxAllowedRoomsPerBlock: 50,
  maxDurationOptionsPerBlock: 20,
  maxHorizonDays: 180,
  maxIdLength: 128,
  maxSolveSeconds: 30,
};

const LOCAL_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export type SolverPayloadLimits = typeof DEFAULT_SOLVER_PAYLOAD_LIMITS;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function countArray(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function validateIdLengths({
  label,
  values,
  maxLength,
  errors,
}: {
  label: string;
  values: unknown[];
  maxLength: number;
  errors: string[];
}) {
  if (values.some((value) => typeof value === "string" && value.length > maxLength)) {
    errors.push(`${label} must be ${maxLength} characters or fewer.`);
  }
}

export function validateSolverPayloadWorkload(
  payload: unknown,
  limits: SolverPayloadLimits = DEFAULT_SOLVER_PAYLOAD_LIMITS
) {
  const errors: string[] = [];

  if (!isRecord(payload)) {
    return ["Solver payload must be a JSON object."];
  }

  const blocks = payload.blocks;
  const people = payload.people;
  const rooms = payload.rooms;
  const precedences = payload.precedences;

  if (!Array.isArray(blocks)) {
    errors.push("Solver payload must include a blocks array.");
  } else if (blocks.length > limits.maxBlocks) {
    errors.push(`Solver payload cannot include more than ${limits.maxBlocks} blocks.`);
  }

  if (!Array.isArray(people)) {
    errors.push("Solver payload must include a people array.");
  } else if (people.length > limits.maxPeople) {
    errors.push(`Solver payload cannot include more than ${limits.maxPeople} people.`);
  }

  if (!Array.isArray(rooms)) {
    errors.push("Solver payload must include a rooms array.");
  } else if (rooms.length > limits.maxRooms) {
    errors.push(`Solver payload cannot include more than ${limits.maxRooms} rooms.`);
  }

  if (typeof precedences !== "undefined") {
    if (!Array.isArray(precedences)) {
      errors.push("Solver payload precedences must be an array.");
    } else if (precedences.length > limits.maxPrecedences) {
      errors.push(
        `Solver payload cannot include more than ${limits.maxPrecedences} dependencies.`
      );
    }
  }

  const horizonStart = typeof payload.horizon_start === "string"
    ? new Date(payload.horizon_start)
    : null;
  const horizonEnd = typeof payload.horizon_end === "string"
    ? new Date(payload.horizon_end)
    : null;
  if (horizonStart && horizonEnd && !Number.isNaN(horizonStart.getTime()) && !Number.isNaN(horizonEnd.getTime())) {
    const horizonDays =
      (horizonEnd.getTime() - horizonStart.getTime()) / (24 * 60 * 60 * 1000);
    if (horizonDays > limits.maxHorizonDays) {
      errors.push(
        `Solver horizon cannot be longer than ${limits.maxHorizonDays} days.`
      );
    }
  }

  let totalAvailabilityWindows = 0;
  let totalRequiredPeopleReferences = 0;

  if (Array.isArray(blocks)) {
    validateIdLengths({
      label: "Block ids",
      values: blocks.map((block) => (isRecord(block) ? block.id : undefined)),
      maxLength: limits.maxIdLength,
      errors,
    });

    for (const block of blocks) {
      if (!isRecord(block)) {
        continue;
      }

      const requiredPeopleCount =
        countArray(block.required_people_ids) + countArray(block.participant_requirements);
      totalRequiredPeopleReferences += requiredPeopleCount;

      if (requiredPeopleCount > limits.maxRequiredPeoplePerBlock) {
        errors.push(
          `A block cannot require more than ${limits.maxRequiredPeoplePerBlock} people.`
        );
      }

      if (countArray(block.allowed_room_ids) > limits.maxAllowedRoomsPerBlock) {
        errors.push(
          `A block cannot allow more than ${limits.maxAllowedRoomsPerBlock} rooms.`
        );
      }

      if (countArray(block.allowed_duration_minutes) > limits.maxDurationOptionsPerBlock) {
        errors.push(
          `A block cannot include more than ${limits.maxDurationOptionsPerBlock} duration options.`
        );
      }
    }
  }

  if (totalRequiredPeopleReferences > limits.maxTotalRequiredPeopleReferences) {
    errors.push(
      `Solver payload cannot include more than ${limits.maxTotalRequiredPeopleReferences} total participant requirements.`
    );
  }

  if (Array.isArray(people)) {
    validateIdLengths({
      label: "Person ids",
      values: people.map((person) => (isRecord(person) ? person.id : undefined)),
      maxLength: limits.maxIdLength,
      errors,
    });

    for (const person of people) {
      if (isRecord(person)) {
        totalAvailabilityWindows += countArray(person.availability_windows);
      }
    }
  }

  if (Array.isArray(rooms)) {
    validateIdLengths({
      label: "Room ids",
      values: rooms.map((room) => (isRecord(room) ? room.id : undefined)),
      maxLength: limits.maxIdLength,
      errors,
    });

    for (const room of rooms) {
      if (isRecord(room)) {
        totalAvailabilityWindows += countArray(room.availability_windows);
      }
    }
  }

  if (totalAvailabilityWindows > limits.maxAvailabilityWindows) {
    errors.push(
      `Solver payload cannot include more than ${limits.maxAvailabilityWindows} availability windows.`
    );
  }

  const constraintConfig = payload.constraint_config;
  if (isRecord(constraintConfig)) {
    const maxSolveSeconds = constraintConfig.max_solve_seconds;
    if (
      typeof maxSolveSeconds === "number" &&
      Number.isFinite(maxSolveSeconds) &&
      maxSolveSeconds > limits.maxSolveSeconds
    ) {
      errors.push(
        `max_solve_seconds cannot be greater than ${limits.maxSolveSeconds}.`
      );
    }
  }

  return [...new Set(errors)];
}

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
