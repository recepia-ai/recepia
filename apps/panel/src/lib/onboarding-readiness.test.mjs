import assert from "node:assert/strict";
import test from "node:test";
import { pilotReadiness } from "./onboarding-readiness.ts";

test("a newly provisioned clinic remains safely inactive", () => {
  const items = pilotReadiness({
    clinicConfigured: true,
    adminCount: 1,
    teamCount: 2,
    serviceCount: 1,
    veterinarianCount: 1,
    scheduleCount: 1,
    googleConnected: false,
    whatsappConfigured: false,
    phoneConfigured: false,
    transferConfigured: false,
    webSmoke: false,
    whatsappSmoke: false,
    phoneSmoke: false,
    channels: { web: false, whatsapp: false, phone: false },
  });
  assert.equal(items.find((item) => item.key === "clinic")?.ready, true);
  assert.equal(items.find((item) => item.key === "progressive_activation")?.ready, false);
});
