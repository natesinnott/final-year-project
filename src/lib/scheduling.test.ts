import test from "node:test";
import assert from "node:assert/strict";
import { buildAvailabilityFromConflicts } from "./conflictAvailability.ts";
import {
  buildSolverBlockId,
  buildSolverPayload,
  getDefaultAllowedTimeWindow,
  normalizeAllowedTimeWindowInput,
  validateAllowedTimeWindow,
  validateSolverPayloadWorkload,
  validateSolverPrecedences,
  wouldCreateDependencyCycle,
} from "./scheduling.ts";

test("members with no conflicts are available for the full solve horizon", () => {
  const availability = buildAvailabilityFromConflicts({
    conflicts: [],
    horizonStart: new Date("2025-03-10T09:00:00.000Z"),
    horizonEnd: new Date("2025-03-10T17:00:00.000Z"),
  });

  assert.deepEqual(availability, [
    {
      start: "2025-03-10T09:00:00.000Z",
      end: "2025-03-10T17:00:00.000Z",
    },
  ]);
});

test("conflicts are clipped, merged, and subtracted from the solve horizon", () => {
  const availability = buildAvailabilityFromConflicts({
    conflicts: [
      {
        start: "2025-03-10T08:30:00.000Z",
        end: "2025-03-10T10:00:00.000Z",
      },
      {
        start: "2025-03-10T10:30:00.000Z",
        end: "2025-03-10T11:30:00.000Z",
      },
      {
        start: "2025-03-10T11:15:00.000Z",
        end: "2025-03-10T12:00:00.000Z",
      },
      {
        start: "2025-03-10T14:00:00.000Z",
        end: "2025-03-10T14:15:00.000Z",
      },
    ],
    horizonStart: new Date("2025-03-10T09:00:00.000Z"),
    horizonEnd: new Date("2025-03-10T17:00:00.000Z"),
  });

  assert.deepEqual(availability, [
    {
      start: "2025-03-10T10:00:00.000Z",
      end: "2025-03-10T10:30:00.000Z",
    },
    {
      start: "2025-03-10T12:00:00.000Z",
      end: "2025-03-10T14:00:00.000Z",
    },
    {
      start: "2025-03-10T14:15:00.000Z",
      end: "2025-03-10T17:00:00.000Z",
    },
  ]);
});

test("conflicts that cover the full horizon leave no availability", () => {
  const availability = buildAvailabilityFromConflicts({
    conflicts: [
      {
        start: "invalid",
        end: "2025-03-10T12:00:00.000Z",
      },
      {
        start: "2025-03-10T08:00:00.000Z",
        end: "2025-03-10T12:00:00.000Z",
      },
      {
        start: "2025-03-10T12:00:00.000Z",
        end: "2025-03-10T18:00:00.000Z",
      },
    ],
    horizonStart: new Date("2025-03-10T09:00:00.000Z"),
    horizonEnd: new Date("2025-03-10T17:00:00.000Z"),
  });

  assert.deepEqual(availability, []);
});

test("buildSolverPayload includes the allowed rehearsal time window", () => {
  const payload = buildSolverPayload({
    horizonStart: "2026-03-01T08:00",
    horizonEnd: "2026-03-01T12:00",
    timeZone: "UTC",
    allowedStartTime: "08:00",
    allowedEndTime: "23:30",
    blocks: [
      {
        clientId: "block-1",
        label: "Scene work",
        durationMinutes: 60,
        requiredPeopleIds: ["person-1"],
        predecessorBlockIds: [],
      },
    ],
    members: [
      {
        userId: "person-1",
        name: "Alex",
        email: "alex@example.com",
        role: "Director",
        submittedAt: "2026-03-01T07:00:00.000Z",
        windows: [],
      },
    ],
  });

  assert.ok(payload);
  assert.equal(payload?.time_zone, "UTC");
  assert.deepEqual(payload?.allowed_time_window, {
    start_local_time: "08:00",
    end_local_time: "23:30",
  });
});

test("buildSolverPayload maps block dependencies to solver precedence edges", () => {
  const introBlock = {
    clientId: "block-intro",
    label: "Intro scene",
    durationMinutes: 45,
    requiredPeopleIds: ["person-1"],
    predecessorBlockIds: [],
  };
  const finaleBlock = {
    clientId: "block-finale",
    label: "Finale",
    durationMinutes: 60,
    requiredPeopleIds: ["person-1", "person-2"],
    predecessorBlockIds: ["block-intro"],
  };

  const payload = buildSolverPayload({
    horizonStart: "2026-03-01T08:00",
    horizonEnd: "2026-03-01T12:00",
    timeZone: "UTC",
    allowedStartTime: "08:00",
    allowedEndTime: "23:30",
    blocks: [introBlock, finaleBlock],
    members: [
      {
        userId: "person-1",
        name: "Alex",
        email: "alex@example.com",
        role: "Director",
        submittedAt: "2026-03-01T07:00:00.000Z",
        windows: [],
      },
      {
        userId: "person-2",
        name: "Sam",
        email: "sam@example.com",
        role: "Cast",
        submittedAt: "2026-03-01T07:00:00.000Z",
        windows: [],
      },
    ],
  });

  assert.ok(payload);
  assert.deepEqual(payload?.precedences, [
    {
      block_a: buildSolverBlockId(introBlock),
      block_b: buildSolverBlockId(finaleBlock),
    },
  ]);
});

test("buildSolverPayload rejects nonexistent local horizon instants", () => {
  const payload = buildSolverPayload({
    horizonStart: "2025-03-09T02:30",
    horizonEnd: "2025-03-09T04:00",
    timeZone: "America/New_York",
    allowedStartTime: "00:00",
    allowedEndTime: "23:30",
    blocks: [
      {
        clientId: "block-1",
        label: "Scene work",
        durationMinutes: 60,
        requiredPeopleIds: ["person-1"],
        predecessorBlockIds: [],
      },
    ],
    members: [
      {
        userId: "person-1",
        name: "Alex",
        email: "alex@example.com",
        role: "Director",
        submittedAt: "2026-03-01T07:00:00.000Z",
        windows: [],
      },
    ],
  });

  assert.equal(payload, null);
});

test("validateAllowedTimeWindow rejects invalid ranges", () => {
  const errors = validateAllowedTimeWindow({
    startLocalTime: "23:30",
    endLocalTime: "08:00",
  });

  assert.deepEqual(errors, [
    "Earliest rehearsal start must be earlier than latest rehearsal end.",
  ]);
});

test("normalizeAllowedTimeWindowInput applies defaults when omitted", () => {
  const normalized = normalizeAllowedTimeWindowInput(undefined);

  assert.equal(normalized.error, null);
  assert.deepEqual(normalized.allowedTimeWindow, getDefaultAllowedTimeWindow());
});

test("normalizeAllowedTimeWindowInput rejects malformed time strings", () => {
  const normalized = normalizeAllowedTimeWindowInput({
    start_local_time: "8:00",
    end_local_time: "23:30",
  });

  assert.equal(
    normalized.error,
    "allowed_time_window.start_local_time must use HH:MM."
  );
  assert.equal(normalized.allowedTimeWindow, null);
});

test("validateSolverPrecedences rejects unknown ids, self references, and cycles", () => {
  const errors = validateSolverPrecedences({
    blockIds: ["a", "b", "c"],
    precedences: [
      { block_a: "a", block_b: "missing" },
      { block_a: "b", block_b: "b" },
      { block_a: "a", block_b: "c" },
      { block_a: "c", block_b: "a" },
    ],
  });

  assert.deepEqual(errors, [
    "Dependencies must reference known block ids.",
    "A block cannot depend on itself.",
    "Dependencies cannot create a circular chain.",
  ]);
});

test("validateSolverPayloadWorkload allows large production-sized payloads", () => {
  const people = Array.from({ length: 30 }, (_, index) => ({
    id: `person-${index}`,
    availability_windows: [
      {
        start: "2026-03-01T08:00:00.000Z",
        end: "2026-03-31T22:00:00.000Z",
      },
    ],
  }));
  const blocks = Array.from({ length: 300 }, (_, index) => ({
    id: `block-${index}`,
    duration_minutes: 60,
    required_people_ids: [`person-${index % people.length}`],
    fixed_room_id: "room-a",
  }));

  const errors = validateSolverPayloadWorkload({
    horizon_start: "2026-03-01T08:00:00.000Z",
    horizon_end: "2026-03-31T22:00:00.000Z",
    time_granularity_minutes: 15,
    blocks,
    people,
    rooms: [
      {
        id: "room-a",
        availability_windows: [
          {
            start: "2026-03-01T08:00:00.000Z",
            end: "2026-03-31T22:00:00.000Z",
          },
        ],
      },
    ],
    precedences: [],
  });

  assert.deepEqual(errors, []);
});

test("validateSolverPayloadWorkload rejects abusive payload scale", () => {
  const errors = validateSolverPayloadWorkload(
    {
      horizon_start: "2026-03-01T08:00:00.000Z",
      horizon_end: "2027-03-01T08:00:00.000Z",
      blocks: Array.from({ length: 4 }, (_, index) => ({
        id: `block-${index}`,
        duration_minutes: 60,
        required_people_ids: ["p1", "p2", "p3"],
      })),
      people: [],
      rooms: [],
      precedences: [],
      constraint_config: {
        max_solve_seconds: 60,
      },
    },
    {
      maxBlocks: 3,
      maxPeople: 10,
      maxRooms: 2,
      maxAvailabilityWindows: 20,
      maxPrecedences: 20,
      maxRequiredPeoplePerBlock: 2,
      maxTotalRequiredPeopleReferences: 10,
      maxAllowedRoomsPerBlock: 2,
      maxDurationOptionsPerBlock: 2,
      maxHorizonDays: 30,
      maxIdLength: 128,
      maxSolveSeconds: 30,
    }
  );

  assert.deepEqual(errors, [
    "Solver payload cannot include more than 3 blocks.",
    "Solver horizon cannot be longer than 30 days.",
    "A block cannot require more than 2 people.",
    "Solver payload cannot include more than 10 total participant requirements.",
    "max_solve_seconds cannot be greater than 30.",
  ]);
});

test("wouldCreateDependencyCycle detects transitive loops", () => {
  const edges = [
    { block_a: "a", block_b: "b" },
    { block_a: "b", block_b: "c" },
  ];

  assert.equal(
    wouldCreateDependencyCycle({
      edges,
      fromBlockId: "c",
      toBlockId: "a",
    }),
    true
  );
  assert.equal(
    wouldCreateDependencyCycle({
      edges,
      fromBlockId: "c",
      toBlockId: "d",
    }),
    false
  );
});
