import assert from "node:assert/strict";
import test from "node:test";
import { buildSystemPrompt } from "./system-prompt.ts";

test("prompt is composed from the selected clinic and contains no pilot hardcodes", () => {
  const prompt = buildSystemPrompt({
    clinicId: "clinic-north",
    schemaVersion: 1,
    publicName: "Veterinària Nord",
    agentName: "Nora",
    primaryLanguage: "ca-ES",
    locale: "ca-ES",
    timezone: "Europe/Madrid",
    greetings: { web: "Hola des del web", whatsapp: "Hola per WhatsApp", voice: "Hola per veu" },
    afterHoursMessage: "Tornarem demà.",
    humanFallbackMessage: "L'equip ho revisarà.",
    escalationRules: ["Derivar urgències vitals"],
    recordingEnabled: false,
    aiChannels: { web: false, whatsapp: false, phone: false },
    clinicPhone: "+34 900 000 001",
    clinicAddress: "Carrer Nord 1, Girona",
    services: [
      {
        name: "Consulta felina preventiva",
        description: null,
        durationMinutes: 40,
        priceMinCents: 4500,
        priceMaxCents: 4500,
        isSurgery: false,
        requiresFasting: false,
        escalatesForPricing: false,
      },
    ],
    schedules: [
      { veterinarian: "Dra. Alba", dayOfWeek: 2, startTime: "10:00:00", endTime: "13:00:00" },
    ],
  });
  assert.match(prompt, /Veterinària Nord/);
  assert.match(prompt, /Consulta felina preventiva/);
  assert.match(prompt, /Dra\. Alba/);
  assert.match(prompt, /ca-ES/);
  assert.doesNotMatch(prompt, /Patiño|Patino|Samuel|Anicura/i);
});

test("prompt selects the greeting for the actual text channel", () => {
  const base = {
    clinicId: "clinic-north",
    schemaVersion: 1,
    publicName: "Veterinària Nord",
    agentName: "Nora",
    primaryLanguage: "ca-ES",
    locale: "ca-ES",
    timezone: "Europe/Madrid",
    greetings: { web: "SALUDO_WEB", whatsapp: "SALUDO_WHATSAPP", voice: "SALUDO_VOZ" },
    afterHoursMessage: "Tornarem demà.",
    humanFallbackMessage: "L'equip ho revisarà.",
    escalationRules: [],
    recordingEnabled: false,
    aiChannels: { web: false, whatsapp: false, phone: false },
    clinicPhone: null,
    clinicAddress: null,
    services: [],
    schedules: [],
  };
  assert.match(buildSystemPrompt(base, undefined, "web"), /SALUDO_WEB/);
  assert.doesNotMatch(buildSystemPrompt(base, undefined, "web"), /SALUDO_WHATSAPP/);
  assert.match(buildSystemPrompt(base, undefined, "whatsapp"), /SALUDO_WHATSAPP/);
});
