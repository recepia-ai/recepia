import assert from "node:assert/strict";
import test from "node:test";
import { hasExplicitAppointmentConfirmation } from "./appointment-confirmation.ts";

test("accepts an affirmative reply after an explicit confirmation question", () => {
  assert.equal(
    hasExplicitAppointmentConfirmation(
      [{ sender: "agent", content: "¿Confirmas que reserve esta cita el martes a las 10:00?" }],
      "Sí, confirmo",
    ),
    true,
  );
});

test("rejects an affirmative reply without a preceding confirmation question", () => {
  assert.equal(
    hasExplicitAppointmentConfirmation(
      [{ sender: "agent", content: "Tengo una hora disponible el martes a las 10:00." }],
      "Sí",
    ),
    false,
  );
});

test("rejects a statement that merely mentions confirmation", () => {
  assert.equal(
    hasExplicitAppointmentConfirmation(
      [{ sender: "agent", content: "La confirmación de la cita llegará por mensaje." }],
      "Sí",
    ),
    false,
  );
});

test("rejects a non-affirmative reply", () => {
  assert.equal(
    hasExplicitAppointmentConfirmation(
      [{ sender: "agent", content: "¿Confirmas que reserve esta cita?" }],
      "Prefiero otra hora",
    ),
    false,
  );
});

test("rejects an affirmative prefix followed by changed appointment conditions", () => {
  assert.equal(
    hasExplicitAppointmentConfirmation(
      [{ sender: "agent", content: "¿Confirmas que reserve esta cita el martes a las 10:00?" }],
      "Sí, pero mejor mañana",
    ),
    false,
  );
});

test("rejects a terse affirmative that proposes a different time", () => {
  assert.equal(
    hasExplicitAppointmentConfirmation(
      [{ sender: "agent", content: "¿Confirmas que reserve esta cita el martes a las 10:00?" }],
      "Vale, a las once",
    ),
    false,
  );
});

test("uses the latest conversational message and ignores tool evidence", () => {
  assert.equal(
    hasExplicitAppointmentConfirmation(
      [
        { sender: "agent", content: "¿Confirmas que reserve esta cita?" },
        { sender: "system", content: "[tool_result: check_availability]" },
      ],
      "Vale, adelante",
    ),
    true,
  );
});
