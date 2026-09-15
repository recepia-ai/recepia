import assert from "node:assert/strict";
import test from "node:test";
import {
  DATABASE_UUID_PATTERN,
  euroInputToCents,
  isValidConsultationInterval,
  serviceSlug,
} from "./operations-config.ts";

test("accepts seeded database UUIDs without an RFC version nibble", () => {
  assert.equal(DATABASE_UUID_PATTERN.test("00000000-0000-0000-0000-000000000101"), true);
});

test("builds stable service slugs", () => {
  assert.equal(serviceSlug("Revisión sintética — Perro"), "revision-sintetica-perro");
});

test("parses euro inputs into integer cents", () => {
  assert.equal(euroInputToCents("49,95"), 4995);
  assert.equal(euroInputToCents(""), null);
  assert.equal(euroInputToCents("-1"), null);
});

test("requires consultation hours to have an ordered interval", () => {
  assert.equal(isValidConsultationInterval("09:00", "13:30"), true);
  assert.equal(isValidConsultationInterval("13:30", "09:00"), false);
  assert.equal(isValidConsultationInterval("9:00", "13:30"), false);
});
