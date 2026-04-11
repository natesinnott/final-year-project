import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSchedulingDraftState } from "./scheduling-draft.ts";

test("normalizeSchedulingDraftState reloads persisted allowed rehearsal hours", () => {
  const draft = normalizeSchedulingDraftState({
    selectedTimeZone: "UTC",
    horizonStart: "2026-03-01T08:00",
    horizonEnd: "2026-03-01T12:00",
    allowedStartTime: "09:00",
    allowedEndTime: "22:15",
    blocks: [],
  });

  assert.deepEqual(draft, {
    selectedTimeZone: "UTC",
    horizonStart: "2026-03-01T08:00",
    horizonEnd: "2026-03-01T12:00",
    allowedStartTime: "09:00",
    allowedEndTime: "22:15",
    blocks: [],
  });
});

test("normalizeSchedulingDraftState backfills default rehearsal hours for legacy drafts", () => {
  const draft = normalizeSchedulingDraftState({
    selectedTimeZone: "UTC",
    horizonStart: "2026-03-01T08:00",
    horizonEnd: "2026-03-01T12:00",
    blocks: [],
  });

  assert.deepEqual(draft, {
    selectedTimeZone: "UTC",
    horizonStart: "2026-03-01T08:00",
    horizonEnd: "2026-03-01T12:00",
    allowedStartTime: "08:00",
    allowedEndTime: "23:30",
    blocks: [],
  });
});
