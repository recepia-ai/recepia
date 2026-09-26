import type { Database } from "@recepia/db";
import type { SupabaseClient } from "@supabase/supabase-js";

type JsonObject = Record<string, unknown>;
type AdminClient = SupabaseClient<Database>;

export type ClinicAgentConfig = {
  schemaVersion: 1;
  publicName: string;
  agentName: string;
  primaryLanguage: string;
  locale: string;
  timezone: string;
  greetings: { web: string; whatsapp: string; voice: string };
  afterHoursMessage: string;
  humanFallbackMessage: string;
  escalationRules: string[];
  recordingEnabled: boolean;
  aiChannels: { web: boolean; whatsapp: boolean; phone: boolean };
};

export type ClinicAgentContext = ClinicAgentConfig & {
  clinicId: string;
  clinicPhone: string | null;
  clinicAddress: string | null;
  services: Array<{
    name: string;
    description: string | null;
    durationMinutes: number;
    priceMinCents: number | null;
    priceMaxCents: number | null;
    isSurgery: boolean;
    requiresFasting: boolean;
    escalatesForPricing: boolean;
  }>;
  schedules: Array<{
    veterinarian: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
};

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
}

export function clinicAgentConfigFromData(
  clinic: { name: string; locale: string; timezone: string },
  rawConfig: unknown,
): ClinicAgentConfig {
  const root = object(rawConfig);
  const identity = object(root.identity);
  const messages = object(root.messages);
  const afterHours = object(root.after_hours);
  const escalation = object(root.escalation);
  const voice = object(root.voice);
  const operations = object(root.operations);
  const channels = object(operations.ai_channels);
  const publicName = text(identity.public_name ?? identity.clinic_name, clinic.name);
  const agentName = text(identity.agent_name, "Recepia");

  return {
    schemaVersion: 1,
    publicName,
    agentName,
    primaryLanguage: text(identity.primary_language ?? identity.language_default, clinic.locale),
    locale: clinic.locale,
    timezone: clinic.timezone,
    greetings: {
      web: text(
        messages.web_greeting,
        `Soy ${agentName}, el asistente de IA de ${publicName}. ¿En qué puedo ayudarte?`,
      ),
      whatsapp: text(
        messages.whatsapp_greeting,
        `Soy ${agentName}, el asistente de IA de ${publicName}. ¿En qué puedo ayudarte?`,
      ),
      voice: text(
        messages.voice_greeting,
        `${publicName}, le atiende ${agentName}, el asistente de inteligencia artificial del equipo. ¿En qué puedo ayudarle?`,
      ),
    },
    afterHoursMessage: text(
      afterHours.message,
      "En este momento estamos fuera del horario configurado. Puedo tomar nota para que el equipo lo revise.",
    ),
    humanFallbackMessage: text(
      messages.human_fallback,
      "No he podido completar esta gestión. La dejo para revisión del equipo sin confirmar ninguna cita.",
    ),
    escalationRules: strings(escalation.rules),
    recordingEnabled: boolean(voice.recording_enabled, false),
    aiChannels: {
      web: boolean(channels.web, false),
      whatsapp: boolean(channels.whatsapp, false),
      phone: boolean(channels.phone, false),
    },
  };
}

export function mergeClinicAgentConfig(
  current: unknown,
  values: ClinicAgentConfig,
): Database["public"]["Tables"]["clinic_config"]["Update"]["config"] {
  const root = object(current);
  return {
    ...root,
    schema_version: 1,
    identity: {
      ...object(root.identity),
      public_name: values.publicName,
      agent_name: values.agentName,
      primary_language: values.primaryLanguage,
    },
    messages: {
      ...object(root.messages),
      web_greeting: values.greetings.web,
      whatsapp_greeting: values.greetings.whatsapp,
      voice_greeting: values.greetings.voice,
      human_fallback: values.humanFallbackMessage,
    },
    after_hours: { ...object(root.after_hours), message: values.afterHoursMessage },
    escalation: { ...object(root.escalation), rules: values.escalationRules },
    voice: { ...object(root.voice), recording_enabled: values.recordingEnabled },
    operations: {
      ...object(root.operations),
      ai_channels: values.aiChannels,
    },
  } as Database["public"]["Tables"]["clinic_config"]["Update"]["config"];
}

function clinicAddress(clinic: {
  address_street: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  address_country: string | null;
}): string | null {
  const parts = [
    clinic.address_street,
    clinic.address_postal_code,
    clinic.address_city,
    clinic.address_country,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export async function loadClinicAgentContext(
  supabase: AdminClient,
  clinicId: string,
): Promise<ClinicAgentContext> {
  const [
    { data: clinic, error: clinicError },
    { data: configRow },
    { data: services },
    { data: hours },
  ] = await Promise.all([
    supabase
      .from("clinics")
      .select(
        "id, name, locale, timezone, phone, address_street, address_postal_code, address_city, address_country",
      )
      .eq("id", clinicId)
      .single(),
    supabase.from("clinic_config").select("config").eq("clinic_id", clinicId).maybeSingle(),
    supabase
      .from("services")
      .select(
        "name, description, duration_minutes, price_min_cents, price_max_cents, is_surgery, requires_fasting, escalates_for_pricing",
      )
      .eq("clinic_id", clinicId)
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("vet_consultation_hours")
      .select("day_of_week, start_time, end_time, clinic_users(display_name)")
      .eq("clinic_id", clinicId)
      .order("day_of_week")
      .order("start_time"),
  ]);
  if (clinicError || !clinic) throw new Error("No se pudo cargar la configuración de la clínica");
  const config = clinicAgentConfigFromData(clinic, configRow?.config);
  return {
    clinicId,
    ...config,
    clinicPhone: clinic.phone,
    clinicAddress: clinicAddress(clinic),
    services: (services ?? []).map((service) => ({
      name: service.name,
      description: service.description,
      durationMinutes: service.duration_minutes,
      priceMinCents: service.price_min_cents,
      priceMaxCents: service.price_max_cents,
      isSurgery: service.is_surgery,
      requiresFasting: service.requires_fasting,
      escalatesForPricing: service.escalates_for_pricing,
    })),
    schedules: (hours ?? []).map((hour) => {
      const relation = Array.isArray(hour.clinic_users) ? hour.clinic_users[0] : hour.clinic_users;
      return {
        veterinarian: relation?.display_name ?? "Veterinario",
        dayOfWeek: hour.day_of_week,
        startTime: hour.start_time,
        endTime: hour.end_time,
      };
    }),
  };
}

export function voiceGreeting(config: ClinicAgentConfig): string {
  return config.recordingEnabled
    ? `${config.greetings.voice} Esta llamada puede grabarse según la política informada por la clínica.`
    : config.greetings.voice;
}
