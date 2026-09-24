import type { Database } from "@recepia/db";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AutomationChannel = "web" | "whatsapp" | "phone";

export type AutomationControl = Record<AutomationChannel, boolean>;

export const DEFAULT_AUTOMATION_CONTROL: AutomationControl = {
  web: true,
  whatsapp: true,
  phone: true,
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function automationControlFromConfig(config: unknown): AutomationControl {
  const operations = objectValue(objectValue(config).operations);
  const channels = objectValue(operations.ai_channels);
  return {
    web: typeof channels.web === "boolean" ? channels.web : true,
    whatsapp: typeof channels.whatsapp === "boolean" ? channels.whatsapp : true,
    phone: typeof channels.phone === "boolean" ? channels.phone : true,
  };
}

export function withAutomationChannelState(
  config: unknown,
  channel: AutomationChannel,
  enabled: boolean,
  audit: { actorId: string; changedAt: string },
): Record<string, unknown> {
  const current = objectValue(config);
  const operations = objectValue(current.operations);
  const channels = automationControlFromConfig(current);
  return {
    ...current,
    operations: {
      ...operations,
      ai_channels: { ...channels, [channel]: enabled },
      last_changed_at: audit.changedAt,
      last_changed_by: audit.actorId,
      last_changed_channel: channel,
    },
  };
}

export async function getClinicAutomationControl(
  supabaseAdmin: SupabaseClient<Database>,
  clinicId: string,
): Promise<AutomationControl> {
  const { data, error } = await supabaseAdmin
    .from("clinic_config")
    .select("config")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer el control de automatización: ${error.message}`);
  return automationControlFromConfig(data?.config);
}

export function automationDisabledMessage(channel: AutomationChannel): string {
  if (channel === "phone") {
    return "En este momento la atención automática está pausada. El equipo de la clínica revisará tu llamada. Si es urgente, contacta directamente con recepción.";
  }
  return "He recibido tu mensaje, pero la atención automática está pausada. El equipo de la clínica lo revisará y te responderá; no se ha realizado ninguna reserva ni cambio.";
}
