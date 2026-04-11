import test from "node:test";
import assert from "node:assert/strict";
import { buildAvailabilityFromConflicts } from "./conflictAvailability.ts";
import {
  buildSolverPayload,
  getDefaultAllowedTimeWindow,
  normalizeAllowedTimeWindowInput,
  validateAllowedTimeWindow,
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
