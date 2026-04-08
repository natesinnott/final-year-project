import type { TeamAvailabilityMember } from "@/lib/availability";
import { parseLocalDateTimeInput, zonedToUtc } from "@/lib/availabilityTime";
import { buildAvailabilityFromConflicts } from "./conflictAvailability";

export const SCHEDULER_TIME_GRANULARITY_MINUTES = 15;
export const DEFAULT_SCHEDULER_ROOM_ID = "default-room";
export const DEFAULT_SCHEDULER_ROOM_NAME = "Default room";

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

export type SolverPayload = {
  horizon_start: string;
  horizon_end: string;
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
  blocks,
  members,
}: {
  horizonStart: string;
  horizonEnd: string;
  timeZone: string;
  blocks: ScheduleBuilderBlock[];
  members: TeamAvailabilityMember[];
}): SolverPayload | null {
  const parsedHorizonStart = parseSchedulerLocalDateTime(horizonStart, timeZone);
  const parsedHorizonEnd = parseSchedulerLocalDateTime(horizonEnd, timeZone);

  if (!parsedHorizonStart || !parsedHorizonEnd || parsedHorizonEnd <= parsedHorizonStart) {
    return null;
  }

  return {
    horizon_start: parsedHorizonStart.toISOString(),
    horizon_end: parsedHorizonEnd.toISOString(),
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
