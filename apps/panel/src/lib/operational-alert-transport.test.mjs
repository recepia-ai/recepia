import assert from "node:assert/strict";
import test from "node:test";
import {
  operationalAlertEventId,
  operationalAlertSeverity,
} from "./operational-alert-transport-core.ts";

const alert = {
  id: "webhook_repeatedly_failed",
  count: 3,
  group: "clinic_id=clinic-1|provider=evolution",
  windowMs: 300_000,
};

test("deduplicates the same alert group inside its rate-limit window", () => {
  assert.equal(
    operationalAlertEventId(alert, new Date("2026-09-24T16:01:00.000Z")),
    operationalAlertEventId(alert, new Date("2026-09-24T16:04:00.000Z")),
  );
  assert.notEqual(
    operationalAlertEventId(alert, new Date("2026-09-24T16:01:00.000Z")),
    operationalAlertEventId(alert, new Date("2026-09-24T16:06:00.000Z")),
  );
});

test("classifies booking and voice bootstrap alerts as critical", () => {
  assert.equal(operationalAlertSeverity("appointment_creation_failed"), "critical");
  assert.equal(operationalAlertSeverity("vapi_assistant_request_failed"), "critical");
  assert.equal(operationalAlertSeverity("webhook_repeatedly_failed"), "warning");
});
