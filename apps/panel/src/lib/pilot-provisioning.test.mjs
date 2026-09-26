import assert from "node:assert/strict";
import test from "node:test";
import {
  initialPilotClinicConfig,
  parsePilotProvisioningSpec,
  provisioningIdentityKeys,
} from "./pilot-provisioning.ts";

const input = {
  clinic: {
    name: "Clínica Norte",
    public_name: "Clínica Norte",
    slug: "clinica-norte",
    locale: "es-ES",
    timezone: "Europe/Madrid",
    phone: null,
  },
  admin: { email: "admin@example.test", display_name: "Admin Norte" },
  veterinarians: [
    {
      email: "vet@example.test",
      display_name: "Dra. Norte",
      hours: [{ day_of_week: 2, start_time: "10:00", end_time: "13:00" }],
    },
  ],
  services: [
    {
      name: "Consulta felina",
      duration_minutes: 40,
      veterinarian_emails: ["vet@example.test"],
    },
  ],
  agent: {
    name: "Nora",
    primary_language: "es-ES",
    web_greeting: "Soy Nora, asistente de IA de Clínica Norte.",
    whatsapp_greeting: "Soy Nora, asistente de IA de Clínica Norte.",
    voice_greeting: "Clínica Norte, le atiende Nora, asistente de IA.",
    after_hours_message: "Estamos fuera de horario; el equipo revisará su mensaje.",
    human_fallback_message: "El equipo revisará su solicitud sin confirmar ninguna cita.",
    escalation_rules: ["Derivar consultas de animales exóticos"],
  },
};

test("provisioning identities are stable, unique and therefore rerunnable", () => {
  const spec = parsePilotProvisioningSpec(input);
  const first = provisioningIdentityKeys(spec);
  const second = provisioningIdentityKeys(parsePilotProvisioningSpec(input));
  assert.deepEqual(first, second);
  assert.equal(new Set(first).size, first.length);
});

test("new clinics start with every AI channel and recording disabled", () => {
  const config = initialPilotClinicConfig(parsePilotProvisioningSpec(input));
  assert.deepEqual(config.operations.ai_channels, { web: false, whatsapp: false, phone: false });
  assert.equal(config.voice.recording_enabled, false);
});
