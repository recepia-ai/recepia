import assert from "node:assert/strict";
import test from "node:test";
import {
  findMatchingConfirmedAppointment,
  isSameAppointmentMutationToolInput,
  isSameAppointmentToolInput,
  markAppointmentMutationResultReused,
  markAppointmentResultReused,
  shouldBlockBookingErrorEscalation,
} from "./appointment-reliability.ts";

const intent = {
  conversation_id: "conversation-1",
  client_id: "client-1",
  pet_id: "pet-1",
  vet_user_id: "vet-1",
  service_id: "service-1",
  starts_at: "2026-09-17T17:30:00+02:00",
};

test("reuses the same confirmed appointment for a repeated confirmed intent", () => {
  const existing = {
    ...intent,
    id: "appointment-1",
    status: "confirmed",
    google_event_id: "event-1",
    starts_at: "2026-09-17T15:30:00.000Z",
  };

  assert.deepEqual(findMatchingConfirmedAppointment([existing], intent), existing);
});

test("does not reuse a different appointment", () => {
  const different = {
    ...intent,
    id: "appointment-2",
    status: "confirmed",
    google_event_id: "event-2",
    service_id: "service-2",
  };

  assert.equal(findMatchingConfirmedAppointment([different], intent), null);
});

test("recognizes a repeated create appointment invocation for the same instant", () => {
  assert.equal(
    isSameAppointmentToolInput(intent, {
      ...intent,
      starts_at: "2026-09-17T15:30:00.000Z",
      notes: "updated wording",
    }),
    true,
  );
});

test("marks a reused successful tool result without changing its appointment", () => {
  assert.deepEqual(
    markAppointmentResultReused({
      success: true,
      data: { appointment_id: "appointment-1", already_created: false },
    }),
    {
      success: true,
      data: { appointment_id: "appointment-1", already_created: true },
    },
  );
});

test("recognizes duplicate modify and cancel tool calls", () => {
  assert.equal(
    isSameAppointmentMutationToolInput(
      "modify_appointment",
      { appointment_id: "appointment-1", starts_at: "2026-09-18T17:00:00+02:00" },
      { appointment_id: "appointment-1", starts_at: "2026-09-18T15:00:00.000Z" },
    ),
    true,
  );
  assert.equal(
    isSameAppointmentMutationToolInput(
      "cancel_appointment",
      { appointment_id: "appointment-1", reason: "Petición del cliente" },
      { appointment_id: "appointment-1", reason: "Petición del cliente" },
    ),
    true,
  );
});

test("marks a reused modification result as already applied", () => {
  assert.deepEqual(
    markAppointmentMutationResultReused("modify_appointment", {
      success: true,
      data: { appointment_id: "appointment-1", modified: true, already_applied: false },
    }),
    {
      success: true,
      data: { appointment_id: "appointment-1", modified: true, already_applied: true },
    },
  );
});

test("blocks escalation caused only by a recoverable booking failure", () => {
  assert.equal(
    shouldBlockBookingErrorEscalation("other", "Ok, confirmo la reserva", [
      { name: "create_appointment", output: { success: false } },
    ]),
    true,
  );
});

test("allows a genuine safety escalation after a booking failure", () => {
  assert.equal(
    shouldBlockBookingErrorEscalation("urgent_medical", "No puede respirar", [
      { name: "create_appointment", output: { success: false } },
    ]),
    false,
  );
});

test("requires an actual user request for client_request escalation", () => {
  assert.equal(shouldBlockBookingErrorEscalation("client_request", "Confirmo la cita", []), true);
  assert.equal(
    shouldBlockBookingErrorEscalation("client_request", "Confirmo la cita con Samuel", []),
    true,
  );
  assert.equal(
    shouldBlockBookingErrorEscalation("client_request", "Quiero hablar con una persona", []),
    false,
  );
});
