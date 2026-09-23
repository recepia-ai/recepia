import assert from "node:assert/strict";
import test from "node:test";
import {
  hasRelativeAvailabilityIntent,
  resolveRelativeAvailabilityInput,
} from "./vapi-relative-availability.ts";

const now = new Date("2026-09-23T09:03:00.000Z");

test("resolves mañana por la mañana from the clinic local date", () => {
  const result = resolveRelativeAvailabilityInput(
    {
      service_id: "8e683cf8-2ca2-4687-8c6f-c05b495eba18",
      date_from: "2023-10-31T00:00:00+00:00",
      date_to: "2023-10-31T23:59:59+00:00",
    },
    "¿Qué huecos tienes mañana por la mañana?",
    "Europe/Madrid",
    now,
  );

  assert.equal(result.input.date_from, "2026-09-24T00:00:00+02:00");
  assert.equal(result.input.date_to, "2026-09-24T13:59:59+02:00");
});

test("resolves esta tarde without changing the local day", () => {
  const result = resolveRelativeAvailabilityInput(
    { service_id: "service" },
    "¿Y esta tarde?",
    "Europe/Madrid",
    now,
  );

  assert.equal(result.input.date_from, "2026-09-23T14:00:00+02:00");
  assert.equal(result.input.date_to, "2026-09-23T23:59:59+02:00");
});

test("leaves absolute or ambiguous requests untouched", () => {
  const input = { date_from: "2026-09-25T09:00:00+02:00" };
  const result = resolveRelativeAvailabilityInput(
    input,
    "Quiero una cita por la mañana",
    "Europe/Madrid",
    now,
  );

  assert.equal(hasRelativeAvailabilityIntent("Quiero una cita por la mañana"), false);
  assert.equal(result.input, input);
});
