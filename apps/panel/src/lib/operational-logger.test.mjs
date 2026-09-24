import assert from "node:assert/strict";
import test from "node:test";
import { createOperationalLogRecord, operationalErrorCode } from "./operational-logger.ts";

test("builds a structured, correlation-friendly record without undefined fields", () => {
  const record = createOperationalLogRecord(
    "error",
    "tool.failed",
    {
      clinic_id: "clinic-1",
      conversation_id: "conversation-1",
      call_session_id: "call-1",
      channel: "phone",
      tool: "create_appointment",
      appointment_id: "appointment-1",
      error_code: "PROVIDER_FAILURE",
      duration_ms: 125,
      provider: undefined,
    },
    new Date("2026-09-24T10:00:00.000Z"),
  );

  assert.deepEqual(record, {
    timestamp: "2026-09-24T10:00:00.000Z",
    service: "recepia-panel",
    level: "error",
    event: "tool.failed",
    clinic_id: "clinic-1",
    conversation_id: "conversation-1",
    call_session_id: "call-1",
    channel: "phone",
    tool: "create_appointment",
    appointment_id: "appointment-1",
    error_code: "PROVIDER_FAILURE",
    duration_ms: 125,
  });
  assert.equal("message" in record, false);
  assert.equal("input" in record, false);
});

test("uses provider error codes when available and a stable fallback otherwise", () => {
  assert.equal(operationalErrorCode({ code: "23505" }, "UNKNOWN"), "23505");
  assert.equal(
    operationalErrorCode(new Error("boom"), "CHANNEL_PROCESSING_FAILED"),
    "CHANNEL_PROCESSING_FAILED",
  );
});
