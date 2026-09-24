import assert from "node:assert/strict";
import test from "node:test";
import {
  automationControlFromConfig,
  automationDisabledMessage,
  withAutomationChannelState,
} from "./automation-control.ts";

test("automation defaults to enabled for backwards-compatible clinic configs", () => {
  assert.deepEqual(automationControlFromConfig({ locale: "es" }), {
    web: true,
    whatsapp: true,
    phone: true,
  });
});

test("updates one clinic channel without changing unrelated configuration", () => {
  const updated = withAutomationChannelState(
    { locale: "es", operations: { ai_channels: { web: true, whatsapp: true, phone: true } } },
    "whatsapp",
    false,
    { actorId: "user-1", changedAt: "2026-09-24T16:00:00.000Z" },
  );

  assert.deepEqual(automationControlFromConfig(updated), {
    web: true,
    whatsapp: false,
    phone: true,
  });
  assert.equal(updated.locale, "es");
  assert.equal(updated.operations.last_changed_by, "user-1");
});

test("disabled fallback never claims that an appointment was created", () => {
  for (const channel of ["web", "whatsapp", "phone"]) {
    const message = automationDisabledMessage(channel);
    assert.doesNotMatch(message, /cita (?:confirmada|reservada)/i);
  }
});
