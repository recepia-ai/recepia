import assert from "node:assert/strict";
import test from "node:test";
import { evaluateOperationalAlerts } from "./operational-alerts.ts";
import { createOperationalLogRecord } from "./operational-logger.ts";

const now = new Date("2026-09-24T10:05:00.000Z");

function record(event, context, timestamp = "2026-09-24T10:04:00.000Z") {
  return createOperationalLogRecord("error", event, context, new Date(timestamp));
}

test("alerts on repeated webhook failures but keeps clinics isolated", () => {
  const records = [
    record("webhook.failed", { clinic_id: "clinic-1", provider: "evolution", channel: "whatsapp" }),
    record("webhook.failed", { clinic_id: "clinic-1", provider: "evolution", channel: "whatsapp" }),
    record("webhook.failed", { clinic_id: "clinic-1", provider: "evolution", channel: "whatsapp" }),
    record("webhook.failed", { clinic_id: "clinic-2", provider: "evolution", channel: "whatsapp" }),
  ];

  const alerts = evaluateOperationalAlerts(records, now);
  assert.equal(alerts.filter((alert) => alert.id === "webhook_repeatedly_failed").length, 1);
  assert.match(alerts.find((alert) => alert.id === "webhook_repeatedly_failed").group, /clinic-1/);
});

test("alerts on Google failures and ignores expected booking rejections", () => {
  const alerts = evaluateOperationalAlerts(
    [
      record("tool.failed", {
        clinic_id: "clinic-1",
        tool: "check_availability",
        error_code: "GOOGLE_CALENDAR_UNAVAILABLE",
      }),
      record("tool.failed", {
        clinic_id: "clinic-1",
        tool: "check_availability",
        error_code: "GOOGLE_CALENDAR_UNAVAILABLE",
      }),
      record("tool.failed", {
        clinic_id: "clinic-1",
        tool: "create_appointment",
        error_code: "CONFIRMATION_REQUIRED",
      }),
    ],
    now,
  );

  assert.ok(alerts.some((alert) => alert.id === "google_calendar_unavailable"));
  assert.equal(
    alerts.some((alert) => alert.id === "appointment_creation_failed"),
    false,
  );
});

test("alerts immediately when assistant-request or appointment creation fails", () => {
  const alerts = evaluateOperationalAlerts(
    [
      record("vapi.assistant_request.failed", {
        clinic_id: "clinic-1",
        provider: "vapi",
        error_code: "VAPI_ASSISTANT_REQUEST_FAILED",
      }),
      record("tool.failed", {
        clinic_id: "clinic-1",
        tool: "create_appointment",
        error_code: "PROVIDER_FAILURE",
      }),
    ],
    now,
  );

  assert.ok(alerts.some((alert) => alert.id === "vapi_assistant_request_failed"));
  assert.ok(alerts.some((alert) => alert.id === "appointment_creation_failed"));
});
