import assert from "node:assert/strict";
import test from "node:test";
import { getExplicitAppointmentConfirmation } from "../agent/appointment-confirmation.ts";
import {
  extractVapiToolCalls,
  isFinalVapiTranscript,
  vapiConfirmationConversation,
  vapiOccurredAt,
  vapiToolCallArguments,
} from "./vapi-payload.ts";

test("accepts current Vapi parameters and legacy arguments payloads", () => {
  const [current] = extractVapiToolCalls({
    message: {
      toolCallList: [{ id: "call-1", name: "lookup_client", parameters: { phone: "+34000" } }],
    },
  });
  assert.deepEqual(vapiToolCallArguments(current), { phone: "+34000" });

  const [legacy] = extractVapiToolCalls({
    message: {
      toolCallList: [{ id: "call-2", name: "lookup_client", arguments: '{"phone":"+34111"}' }],
    },
  });
  assert.deepEqual(vapiToolCallArguments(legacy), { phone: "+34111" });
});

test("normalizes wrapped Vapi function parameters", () => {
  const [call] = extractVapiToolCalls({
    message: {
      toolWithToolCallList: [
        {
          name: "check_availability",
          toolCall: {
            id: "call-3",
            function: { name: "check_availability", parameters: { service_id: "service" } },
          },
        },
      ],
    },
  });
  assert.equal(call.name, "check_availability");
  assert.deepEqual(vapiToolCallArguments(call), { service_id: "service" });
});

test("extracts the user confirmation turn and only the preceding conversation", () => {
  const context = vapiConfirmationConversation({
    message: {
      artifact: {
        messages: [
          { role: "assistant", message: "¿Confirmas que reserve esta cita?" },
          { role: "user", message: "Sí" },
          { role: "assistant", content: [{ type: "tool_use", name: "create_appointment" }] },
        ],
      },
    },
  });
  assert.deepEqual(context, {
    previousMessages: [{ sender: "agent", content: "¿Confirmas que reserve esta cita?" }],
    currentUserMessage: "Sí",
  });
  assert.equal(
    getExplicitAppointmentConfirmation(context.previousMessages, context.currentUserMessage),
    "create",
  );
});

test("does not authorize a conditional voice confirmation", () => {
  const context = vapiConfirmationConversation({
    message: {
      artifact: {
        messages: [
          { role: "assistant", message: "¿Confirmas que reserve esta cita mañana a las diez?" },
          { role: "user", message: "Sí, pero mejor por la tarde" },
        ],
      },
    },
  });
  assert.equal(
    getExplicitAppointmentConfirmation(context.previousMessages, context.currentUserMessage),
    null,
  );
});

test("recognizes both forms of final transcript event", () => {
  assert.equal(isFinalVapiTranscript("transcript", "final"), true);
  assert.equal(isFinalVapiTranscript('transcript[transcriptType="final"]'), true);
  assert.equal(isFinalVapiTranscript("transcript", "partial"), false);
});

test("normalizes numeric Vapi timestamps", () => {
  assert.equal(vapiOccurredAt(1_700_000_000_000), "2023-11-14T22:13:20.000Z");
});
