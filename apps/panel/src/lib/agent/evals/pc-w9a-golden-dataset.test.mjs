import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveRelativeAvailabilityInput } from "../../channels/vapi-relative-availability.ts";
import { getExplicitAppointmentConfirmation } from "../appointment-confirmation.ts";

const dataset = JSON.parse(
  readFileSync(new URL("./pc-w9a-golden-dataset.json", import.meta.url), "utf8"),
);

const requiredCapabilities = [
  "client_identification",
  "pet_identification",
  "service_lookup",
  "relative_date",
  "absolute_date",
  "timezone",
  "availability",
  "explicit_confirmation",
  "conditional_confirmation",
  "create_appointment",
  "modify_appointment",
  "cancel_appointment",
  "human_takeover",
  "idempotency",
  "tool_retry",
  "duplicate_message_protection",
  "create_once",
];

test("golden dataset covers every pilot-critical capability on web, WhatsApp and phone", () => {
  assert.equal(dataset.version, 1);
  assert.equal(dataset.timezone, "Europe/Madrid");
  assert.deepEqual(
    new Set(dataset.cases.map((entry) => entry.channel)),
    new Set(["web", "whatsapp", "phone"]),
  );
  const covered = new Set(dataset.cases.flatMap((entry) => entry.capabilities));
  for (const capability of requiredCapabilities) assert.ok(covered.has(capability), capability);
  assert.equal(new Set(dataset.cases.map((entry) => entry.id)).size, dataset.cases.length);
});

test("golden relative-date cases resolve deterministically in Europe/Madrid", () => {
  for (const entry of dataset.cases.filter((item) => item.relativeDate)) {
    const input = {
      service_id: "service",
      date_from: "2000-01-01T00:00:00Z",
      date_to: "2000-01-01T23:59:59Z",
    };
    const result = resolveRelativeAvailabilityInput(
      input,
      entry.relativeDate.message,
      dataset.timezone,
      new Date(entry.relativeDate.now),
    );
    assert.equal(result.input.date_from, entry.relativeDate.expectedFrom, entry.id);
    assert.equal(result.input.date_to, entry.relativeDate.expectedTo, entry.id);
  }
});

test("golden absolute dates are preserved without LLM-relative reinterpretation", () => {
  for (const entry of dataset.cases.filter((item) => item.absoluteDate)) {
    const input = {
      service_id: "service",
      date_from: entry.absoluteDate.dateFrom,
      date_to: entry.absoluteDate.dateTo,
    };
    const result = resolveRelativeAvailabilityInput(
      input,
      entry.absoluteDate.message,
      dataset.timezone,
      new Date("2026-09-24T08:00:00.000Z"),
    );
    assert.equal(result.input, input, entry.id);
    assert.equal(result.relativeExpression, null, entry.id);
  }
});

test("golden confirmations authorize only the intended appointment mutation", () => {
  for (const entry of dataset.cases.filter((item) => item.confirmation)) {
    const action = getExplicitAppointmentConfirmation(
      [{ sender: "agent", content: entry.confirmation.prompt }],
      entry.confirmation.reply,
    );
    assert.equal(action, entry.confirmation.expectedAction, entry.id);
  }
});

test("golden cases never expect an appointment mutation more than once", () => {
  for (const entry of dataset.cases) {
    for (const field of [
      "createAppointmentCalls",
      "modifyAppointmentCalls",
      "cancelAppointmentCalls",
    ]) {
      assert.ok((entry.expected[field] ?? 0) <= 1, `${entry.id}:${field}`);
    }
  }
});
