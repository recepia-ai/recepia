import assert from "node:assert/strict";
import test from "node:test";
import {
  monotonicCallStatus,
  vapiDisabledAssistantResponse,
  vapiEventIdentity,
} from "./vapi-resilience.ts";

test("late Vapi events cannot regress a completed call", () => {
  assert.equal(monotonicCallStatus("completed", "ringing"), "completed");
  assert.equal(monotonicCallStatus("in_progress", "queued"), "in_progress");
  assert.equal(monotonicCallStatus("ringing", "in_progress"), "in_progress");
});

test("repeated Vapi events have the same persistent identity", () => {
  const first = vapiEventIdentity("call-1", "transcript", 1234);
  const replay = vapiEventIdentity("call-1", "transcript", 1234);
  assert.equal(first, replay);
});

test("disabled voice response removes tools and forbids confirmations", () => {
  const response = vapiDisabledAssistantResponse("assistant-1", "Atención pausada");
  assert.equal(response.assistantId, "assistant-1");
  assert.deepEqual(response.assistantOverrides.model.tools, []);
  assert.match(response.assistantOverrides.model.messages[0].content, /No ejecutes tools/);
});
