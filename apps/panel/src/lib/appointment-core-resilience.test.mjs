import assert from "node:assert/strict";
import test from "node:test";
import {
  isActiveAppointmentStatus,
  isAppointmentIdentityConflict,
  shouldDeleteGoogleEventAfterInsertFailure,
} from "./appointment-concurrency.ts";
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

test("PostgreSQL 23505 is recognized as an appointment identity race", () => {
  assert.equal(isAppointmentIdentityConflict({ code: "23505" }), true);
  assert.equal(isAppointmentIdentityConflict({ code: "23503" }), false);
  assert.equal(isAppointmentIdentityConflict(null), false);
});

test("a losing insert never deletes the deterministic Google event", () => {
  assert.equal(
    shouldDeleteGoogleEventAfterInsertFailure({
      insertError: { code: "23505" },
      eventCreatedByThisAttempt: true,
    }),
    false,
  );
});

test("a reused Google event is never deleted after an unrelated insert failure", () => {
  assert.equal(
    shouldDeleteGoogleEventAfterInsertFailure({
      insertError: { code: "23503" },
      eventCreatedByThisAttempt: false,
    }),
    false,
  );
  assert.equal(
    shouldDeleteGoogleEventAfterInsertFailure({
      insertError: { code: "23503" },
      eventCreatedByThisAttempt: true,
    }),
    true,
  );
});

test("only cancelled appointments release an identical identity", () => {
  assert.equal(isActiveAppointmentStatus("confirmed"), true);
  assert.equal(isActiveAppointmentStatus("completed"), true);
  assert.equal(isActiveAppointmentStatus("no_show"), true);
  assert.equal(isActiveAppointmentStatus("cancelled"), false);
});
