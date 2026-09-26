import assert from "node:assert/strict";
import test from "node:test";
import { clinicAgentConfigFromData, voiceGreeting } from "./clinic-agent-config.ts";

const clinic = { name: "Clínica Norte", locale: "ca-ES", timezone: "Europe/Madrid" };

test("clinic identity, locale, timezone and greetings come from data", () => {
  const config = clinicAgentConfigFromData(clinic, {
    identity: { public_name: "Veterinària Nord", agent_name: "Nora", primary_language: "ca-ES" },
    messages: { voice_greeting: "Veterinària Nord, soc la Nora, assistent d'IA." },
    operations: { ai_channels: { web: false, whatsapp: false, phone: false } },
  });
  assert.equal(config.publicName, "Veterinària Nord");
  assert.equal(config.locale, "ca-ES");
  assert.equal(config.timezone, "Europe/Madrid");
  assert.deepEqual(config.aiChannels, { web: false, whatsapp: false, phone: false });
  assert.doesNotMatch(voiceGreeting(config), /grabad|enregistr/i);
});

test("recording notice is appended only when explicitly enabled", () => {
  const off = clinicAgentConfigFromData(clinic, { voice: { recording_enabled: false } });
  const on = clinicAgentConfigFromData(clinic, { voice: { recording_enabled: true } });
  assert.equal(voiceGreeting(off), off.greetings.voice);
  assert.match(voiceGreeting(on), /puede grabarse/i);
});
