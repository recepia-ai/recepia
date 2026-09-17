import assert from "node:assert/strict";
import test from "node:test";
import { resolveAvailabilityWindow } from "./availability-window.ts";

const now = new Date("2026-09-17T18:00:00.000Z");

test("rejects availability ranges entirely in the past", () => {
  const result = resolveAvailabilityWindow(
    "2024-06-07T08:00:00+02:00",
    "2024-06-10T20:00:00+02:00",
    now,
  );
  assert.match(result.error ?? "", /rango solicitado ya ha pasado/);
  assert.match(result.error ?? "", /2026-09-17/);
  assert.equal(result.earliest.toISOString(), now.toISOString());
});

test("clips a partially elapsed range to now", () => {
  const result = resolveAvailabilityWindow(
    "2026-09-17T08:00:00+02:00",
    "2026-09-18T20:00:00+02:00",
    now,
  );
  assert.equal(result.error, undefined);
  assert.equal(result.earliest.toISOString(), now.toISOString());
});

test("preserves a future range start", () => {
  const result = resolveAvailabilityWindow(
    "2026-09-18T08:00:00+02:00",
    "2026-09-18T20:00:00+02:00",
    now,
  );
  assert.equal(result.error, undefined);
  assert.equal(result.earliest.toISOString(), "2026-09-18T06:00:00.000Z");
});
