import assert from "node:assert/strict";
import test from "node:test";
import {
  monotonicCallStatus,
  vapiArtifactPlan,
  vapiDisabledAssistantResponse,
  vapiEventIdentity,
} from "./vapi-resilience.ts";

test("recording is off by default and only enabled explicitly", () => {
  assert.equal(vapiArtifactPlan().recordingEnabled, false);
  assert.equal(vapiArtifactPlan(false).recordingEnabled, false);
  assert.equal(vapiArtifactPlan(true).recordingEnabled, true);
  assert.equal(vapiArtifactPlan(true).transcriptPlan.enabled, true);
});

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
  assert.equal(response.assistantOverrides.artifactPlan.recordingEnabled, false);
  assert.equal(response.assistantOverrides.artifactPlan.transcriptPlan.enabled, true);
  assert.deepEqual(response.assistantOverrides.model.tools, []);
  assert.match(response.assistantOverrides.model.messages[0].content, /No ejecutes tools/);
});
