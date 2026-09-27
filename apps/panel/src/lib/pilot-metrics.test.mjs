import assert from "node:assert/strict";
import test from "node:test";
import { buildPilotMetrics } from "./pilot-metrics.ts";

const at = (minute) => `2026-09-27T10:${String(minute).padStart(2, "0")}:00.000Z`;

test("calculates conservative pilot metrics and response time", () => {
  const metrics = buildPilotMetrics("clinic-a", {
    conversations: [
      {
        id: "web",
        clinic_id: "clinic-a",
        channel: "web",
        status: "completed",
        started_at: at(0),
        ended_at: at(4),
        controlled_at: null,
        metadata: {},
      },
      {
        id: "wa",
        clinic_id: "clinic-a",
        channel: "whatsapp",
        status: "completed",
        started_at: at(5),
        ended_at: at(8),
        controlled_at: null,
        metadata: {},
      },
      {
        id: "phone",
        clinic_id: "clinic-a",
        channel: "phone",
        status: "human_handling",
        started_at: at(10),
        ended_at: null,
        controlled_at: at(12),
        metadata: {},
      },
    ],
    calls: [
      {
        id: "call",
        clinic_id: "clinic-a",
        conversation_id: "phone",
        duration_seconds: 120,
        started_at: at(10),
        status: "ended",
      },
    ],
    tools: [
      {
        id: "create",
        clinic_id: "clinic-a",
        conversation_id: "web",
        tool_name: "create_appointment",
        success: true,
        error_code: null,
        duration_ms: 100,
        created_at: at(2),
      },
      {
        id: "escalate",
        clinic_id: "clinic-a",
        conversation_id: "wa",
        tool_name: "escalate_to_human",
        success: true,
        error_code: null,
        duration_ms: 10,
        created_at: at(7),
      },
      {
        id: "failed",
        clinic_id: "clinic-a",
        conversation_id: "phone",
        tool_name: "check_availability",
        success: false,
        error_code: "TIMEOUT",
        duration_ms: 12_000,
        created_at: at(11),
      },
    ],
    appointments: [
      {
        id: "appointment",
        clinic_id: "clinic-a",
        conversation_id: "web",
        created_by: "agent",
        created_at: at(3),
      },
    ],
    messages: [
      {
        id: "in",
        clinic_id: "clinic-a",
        conversation_id: "web",
        direction: "inbound",
        sender: "client",
        created_at: at(0),
      },
      {
        id: "out",
        clinic_id: "clinic-a",
        conversation_id: "web",
        direction: "outbound",
        sender: "agent",
        created_at: at(1),
      },
    ],
    events: [
      {
        id: "take",
        clinic_id: "clinic-a",
        conversation_id: "phone",
        event_type: "conversation.human_takeover",
        created_at: at(12),
      },
    ],
    operationalSignals: [
      {
        id: "vapi",
        clinic_id: "clinic-a",
        event: "vapi.assistant_request.failed",
        timestamp: at(10),
      },
    ],
  });

  assert.deepEqual(metrics.conversationsByChannel, { web: 1, whatsapp: 1, phone: 1 });
  assert.equal(metrics.appointmentsCreated, 1);
  assert.equal(metrics.escalations, 1);
  assert.equal(metrics.takeovers, 1);
  assert.equal(metrics.toolsSucceeded, 2);
  assert.equal(metrics.toolsFailed, 1);
  assert.equal(metrics.assistantRequestFailures, 1);
  assert.equal(metrics.averageResponseMs, 60_000);
  assert.equal(metrics.averageCallDurationSeconds, 120);
  assert.equal(metrics.automaticResolutionCount, 1);
  assert.equal(metrics.automaticResolutionEligible, 2);
  assert.equal(metrics.automaticResolutionRate, 50);
});

test("defensively excludes rows from another clinic", () => {
  const metrics = buildPilotMetrics("clinic-a", {
    conversations: [
      {
        id: "foreign",
        clinic_id: "clinic-b",
        channel: "web",
        status: "completed",
        started_at: at(0),
        ended_at: at(1),
        controlled_at: null,
        metadata: {},
      },
    ],
    calls: [],
    tools: [],
    appointments: [],
    messages: [],
    events: [],
    operationalSignals: [],
  });
  assert.equal(metrics.conversationsTotal, 0);
  assert.equal(metrics.automaticResolutionRate, null);
});
