import assert from "node:assert/strict";
import test from "node:test";
import { shouldSendAutomatedWhatsAppReply } from "./whatsapp-reply-policy.ts";

test("a repeated inbound WhatsApp event never sends the automated reply twice", () => {
  assert.equal(shouldSendAutomatedWhatsAppReply({ response: "Respuesta", duplicate: true }), false);
});

test("a persisted first-pass response is eligible for one provider send", () => {
  assert.equal(shouldSendAutomatedWhatsAppReply({ response: "Respuesta", duplicate: false }), true);
  assert.equal(shouldSendAutomatedWhatsAppReply({ response: null, duplicate: false }), false);
});
