import test from "node:test";
import assert from "node:assert/strict";
import {
  localRangeToUtc,
  utcToDateTimeInputValue,
  utcToZoned,
  zonedToUtc,
} from "./availabilityTime.ts";

const TZ = "America/New_York";

test("spring-forward nonexistent local time is rejected", () => {
  const nonexistent = zonedToUtc(
    { year: 2025, month: 3, day: 9, hour: 2, minute: 30 },
    TZ,
    { rejectNonexistent: true }
  );
  assert.equal(nonexistent, null);

  const mapped = zonedToUtc(
    { year: 2025, month: 3, day: 9, hour: 2, minute: 30 },
    TZ,
    { rejectNonexistent: false }
  );
  assert.ok(mapped instanceof Date);

  const back = utcToZoned(mapped as Date, TZ);
  assert.equal(`${back.year}-${back.month}-${back.day} ${back.hour}:${back.minute}`, "2025-3-9 3:0");
});

test("fall-back ambiguous local time resolves to earlier offset deterministically", () => {
  const ambiguous = zonedToUtc(
    { year: 2025, month: 11, day: 2, hour: 1, minute: 30 },
    TZ,
    { rejectNonexistent: true }
  );

  assert.ok(ambiguous instanceof Date);
  assert.equal((ambiguous as Date).toISOString(), "2025-11-02T05:30:00.000Z");

  const roundTrip = utcToZoned(ambiguous as Date, TZ);
  assert.deepEqual(roundTrip, {
    year: 2025,
    month: 11,
    day: 2,
    hour: 1,
    minute: 30,
  });
});

test("local painted range snaps in local time before UTC conversion", () => {
  const converted = localRangeToUtc(
    { year: 2025, month: 3, day: 10, hour: 18, minute: 7 },
    { year: 2025, month: 3, day: 10, hour: 19, minute: 53 },
    TZ
  );

  assert.ok(converted);
  assert.deepEqual(converted, {
    startUtcIso: "2025-03-10T22:00:00.000Z",
    endUtcIso: "2025-03-11T00:00:00.000Z",
  });
});

test("utc instants format correctly for datetime-local inputs", () => {
  assert.equal(
    utcToDateTimeInputValue("2025-03-10T22:00:00.000Z", TZ),
    "2025-03-10T18:00"
  );
});
