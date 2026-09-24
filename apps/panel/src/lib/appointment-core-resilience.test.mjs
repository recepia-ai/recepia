import assert from "node:assert/strict";
import test from "node:test";
import { googleAppointmentEventId } from "./appointment-idempotency.ts";

const intent = {
  client_id: "client-1",
  pet_id: "pet-1",
  vet_user_id: "vet-1",
  service_id: "service-1",
  starts_at: "2026-09-25T08:30:00+02:00",
};

test("Google appointment identity is stable across safe retries", () => {
  const first = googleAppointmentEventId("clinic-1", intent);
  const retry = googleAppointmentEventId("clinic-1", {
    ...intent,
    starts_at: "2026-09-25T06:30:00.000Z",
  });
  assert.equal(first, retry);
  assert.match(first, /^[0-9a-v]{5,1024}$/);
});

test("different appointment intents cannot reuse a Google event", () => {
  assert.notEqual(
    googleAppointmentEventId("clinic-1", intent),
    googleAppointmentEventId("clinic-1", {
      ...intent,
      starts_at: "2026-09-25T09:00:00+02:00",
    }),
  );
});
