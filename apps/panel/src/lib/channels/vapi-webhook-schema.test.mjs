import assert from "node:assert/strict";
import test from "node:test";
import { vapiWebhookSchema } from "./vapi-schema.ts";

test("accepts nullable fields from a real dynamic Vapi assistant request", () => {
  const webhook = vapiWebhookSchema.parse({
    message: {
      timestamp: 1_790_240_769_092,
      type: "assistant-request",
      call: {
        id: "call-1",
        assistantId: null,
        phoneNumberId: "phone-number-1",
        startedAt: null,
        endedAt: null,
        transcript: null,
        phoneNumber: null,
        customer: { number: "+34600000000" },
        status: "ringing",
        endedReason: null,
        artifact: null,
      },
      phoneNumber: { number: "+34800000000" },
      customer: { number: "+34600000000" },
    },
  });

  assert.equal(webhook.message.call.startedAt, undefined);
  assert.equal(webhook.message.call.endedAt, undefined);
  assert.equal(webhook.message.call.phoneNumber, undefined);
  assert.equal(webhook.message.customer.number, "+34600000000");
  assert.equal(webhook.message.phoneNumber.number, "+34800000000");
});
