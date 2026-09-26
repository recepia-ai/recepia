import { z } from "zod";

function serviceSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const staffSchema = z.object({
  email: z.string().email(),
  display_name: z.string().trim().min(2).max(120),
  specialty: z.string().trim().max(120).optional(),
  hours: z.array(
    z.object({
      day_of_week: z.number().int().min(0).max(6),
      start_time: z.string().regex(/^\d{2}:\d{2}$/),
      end_time: z.string().regex(/^\d{2}:\d{2}$/),
    }),
  ),
});

const serviceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  duration_minutes: z.number().int().min(5).max(480),
  price_min_cents: z.number().int().nonnegative().nullable().default(null),
  price_max_cents: z.number().int().nonnegative().nullable().default(null),
  is_surgery: z.boolean().default(false),
  requires_fasting: z.boolean().default(false),
  escalates_for_pricing: z.boolean().default(false),
  veterinarian_emails: z.array(z.string().email()).min(1),
});

export const pilotProvisioningSchema = z.object({
  clinic: z.object({
    name: z.string().trim().min(2).max(120),
    public_name: z.string().trim().min(2).max(120),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    locale: z.enum(["es-ES", "ca-ES", "en-GB"]),
    timezone: z.string().trim().min(3).max(80),
    phone: z.string().trim().nullable().default(null),
    address: z
      .object({
        street: z.string(),
        city: z.string(),
        postal_code: z.string(),
        country: z.string(),
      })
      .optional(),
  }),
  admin: z.object({ email: z.string().email(), display_name: z.string().trim().min(2).max(120) }),
  veterinarians: z.array(staffSchema).min(1),
  services: z.array(serviceSchema).min(1),
  agent: z.object({
    name: z.string().trim().min(2).max(60).default("Recepia"),
    primary_language: z.enum(["es-ES", "ca-ES", "en-GB"]),
    web_greeting: z.string().trim().min(8).max(500),
    whatsapp_greeting: z.string().trim().min(8).max(500),
    voice_greeting: z.string().trim().min(8).max(500),
    after_hours_message: z.string().trim().min(8).max(1000),
    human_fallback_message: z.string().trim().min(8).max(1000),
    escalation_rules: z.array(z.string().trim().min(3).max(300)).default([]),
  }),
});

export type PilotProvisioningSpec = z.infer<typeof pilotProvisioningSchema>;

export function parsePilotProvisioningSpec(value: unknown): PilotProvisioningSpec {
  const spec = pilotProvisioningSchema.parse(value);
  const vetEmails = new Set(spec.veterinarians.map((vet) => vet.email.toLowerCase()));
  for (const service of spec.services) {
    for (const email of service.veterinarian_emails) {
      if (!vetEmails.has(email.toLowerCase())) {
        throw new Error(`El servicio ${service.name} referencia un veterinario no definido`);
      }
    }
  }
  return spec;
}

export function provisioningIdentityKeys(spec: PilotProvisioningSpec): string[] {
  return [
    `clinic:${spec.clinic.slug}`,
    `staff:${spec.admin.email.toLowerCase()}`,
    ...spec.veterinarians.map((vet) => `staff:${vet.email.toLowerCase()}`),
    ...spec.services.map((service) => `service:${serviceSlug(service.name)}`),
    ...spec.veterinarians.flatMap((vet) =>
      vet.hours.map(
        (hour) => `hours:${vet.email.toLowerCase()}:${hour.day_of_week}:${hour.start_time}`,
      ),
    ),
    ...spec.services.flatMap((service) =>
      service.veterinarian_emails.map(
        (email) => `assignment:${serviceSlug(service.name)}:${email.toLowerCase()}`,
      ),
    ),
  ];
}

export function initialPilotClinicConfig(spec: PilotProvisioningSpec) {
  return {
    schema_version: 1,
    identity: {
      public_name: spec.clinic.public_name,
      agent_name: spec.agent.name,
      primary_language: spec.agent.primary_language,
    },
    messages: {
      web_greeting: spec.agent.web_greeting,
      whatsapp_greeting: spec.agent.whatsapp_greeting,
      voice_greeting: spec.agent.voice_greeting,
      human_fallback: spec.agent.human_fallback_message,
    },
    after_hours: { message: spec.agent.after_hours_message },
    escalation: { rules: spec.agent.escalation_rules },
    voice: { recording_enabled: false },
    operations: { ai_channels: { web: false, whatsapp: false, phone: false } },
  };
}
