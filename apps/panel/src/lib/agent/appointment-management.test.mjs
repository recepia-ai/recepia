import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyAppointmentResolution,
  hasRequiredAppointmentMutationConfirmation,
  isRequestedRescheduleAvailable,
  mergeAppointmentNotes,
  updateGoogleCalendarNotes,
} from "./appointment-management.ts";

test("classifies one appointment as uniquely resolved", () => {
  assert.equal(classifyAppointmentResolution([{ id: "appointment-1" }]), "unique");
});

test("classifies several appointments as ambiguous", () => {
  assert.equal(
    classifyAppointmentResolution([{ id: "appointment-1" }, { id: "appointment-2" }]),
    "ambiguous",
  );
});

test("requires confirmation for the exact mutation action", () => {
  assert.equal(hasRequiredAppointmentMutationConfirmation("modify", "modify"), true);
  assert.equal(hasRequiredAppointmentMutationConfirmation("cancel", "modify"), false);
  assert.equal(hasRequiredAppointmentMutationConfirmation(null, "cancel"), false);
});

test("requires the exact validated vet slot for rescheduling", () => {
  const slots = [{ vet_user_id: "vet-1", starts_at: "2026-09-18T15:00:00.000Z" }];
  assert.equal(isRequestedRescheduleAvailable(slots, "2026-09-18T17:00:00+02:00", "vet-1"), true);
  assert.equal(isRequestedRescheduleAvailable(slots, "2026-09-18T17:30:00+02:00", "vet-1"), false);
});

test("appending notes preserves existing appointment context", () => {
  assert.equal(
    mergeAppointmentNotes("Revisión de ojos", "Revisar también una herida", "append"),
    "Revisión de ojos\nRevisar también una herida",
  );
});

test("appending the same note is idempotent", () => {
  assert.equal(
    mergeAppointmentNotes(
      "Revisión de ojos\nRevisar también una herida",
      "Revisar también una herida",
      "append",
    ),
    "Revisión de ojos\nRevisar también una herida",
  );
});

test("accepts already-combined notes without duplicating existing context", () => {
  assert.equal(
    mergeAppointmentNotes(
      "Revisión de ojos",
      "Revisión de ojos. Revisar también una herida",
      "append",
    ),
    "Revisión de ojos. Revisar también una herida",
  );
});

test("calendar description preserves context while replacing its notes section", () => {
  assert.equal(
    updateGoogleCalendarNotes(
      "Cita veterinaria.\nMascota: Mascota Demo\nNotas: Revisión de ojos",
      "Revisión de ojos\nRevisar también una herida",
    ),
    "Cita veterinaria.\nMascota: Mascota Demo\nNotas: Revisión de ojos\nRevisar también una herida",
  );
});
