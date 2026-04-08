import test from "node:test";
import assert from "node:assert/strict";
import { buildAvailabilityFromConflicts } from "./conflictAvailability";

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
