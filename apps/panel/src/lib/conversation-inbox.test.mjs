import assert from "node:assert/strict";
import test from "node:test";
import {
  conversationControlState,
  isTechnicalConversationMessage,
  readEscalationDetails,
} from "./conversation-inbox.ts";

test("maps operational conversation states", () => {
  assert.equal(conversationControlState("active"), "ai");
  assert.equal(conversationControlState("awaiting_human"), "attention");
  assert.equal(conversationControlState("human_handling"), "human");
  assert.equal(conversationControlState("completed"), "closed");
});

test("reads active escalation metadata safely", () => {
  assert.deepEqual(
    readEscalationDetails({
      escalation: {
        reason: "client_request",
        urgency: "low",
        summary: "El cliente solicita recepción.",
        escalated_at: "2026-09-15T18:00:00Z",
      },
    }),
    {
      reason: "client_request",
      urgency: "low",
      summary: "El cliente solicita recepción.",
      escalatedAt: "2026-09-15T18:00:00Z",
    },
  );
});

test("separates technical tool evidence from the primary transcript", () => {
  assert.equal(
    isTechnicalConversationMessage({
      sender: "system",
      content: "[tool_use: lookup_client]",
      contentType: "tool_call",
    }),
    true,
  );
  assert.equal(
    isTechnicalConversationMessage({ sender: "system", content: "Conversación transferida" }),
    false,
  );
});
