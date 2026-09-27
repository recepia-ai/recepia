"use server";

import type { Database } from "@recepia/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withAutomationChannelState } from "@/lib/automation-control";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminSettingsContext } from "../operations-context";

const updateSchema = z.object({
  channel: z.enum(["web", "whatsapp", "phone"]),
  enabled: z.enum(["true", "false"]).transform((value) => value === "true"),
});

const resolveAlertSchema = z.object({
  alert_event_id: z.string().uuid(),
});

export async function setAutomationChannelState(formData: FormData) {
  const access = await getAdminSettingsContext();
  if (!access.ok) return { error: access.error };
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Estado de canal inválido" };

  const { data: auth } = await access.context.supabase.auth.getUser();
  if (!auth.user) return { error: "No autenticado" };

  const admin = createAdminClient();
  const { data: current, error: readError } = await admin
    .from("clinic_config")
    .select("config")
    .eq("clinic_id", access.context.clinicId)
    .maybeSingle();
  if (readError) return { error: "No se pudo leer la configuración operativa" };

  const changedAt = new Date().toISOString();
  const config = withAutomationChannelState(
    current?.config,
    parsed.data.channel,
    parsed.data.enabled,
    { actorId: auth.user.id, changedAt },
  );
  const values = {
    clinic_id: access.context.clinicId,
    config: config as Database["public"]["Tables"]["clinic_config"]["Update"]["config"],
    updated_by: auth.user.id,
    updated_at: changedAt,
  };
  const { error } = current
    ? await admin.from("clinic_config").update(values).eq("clinic_id", access.context.clinicId)
    : await admin.from("clinic_config").insert(values);
  if (error) {
    console.error("[setAutomationChannelState]", error);
    return { error: "No se pudo actualizar el kill switch" };
  }

  revalidatePath("/settings/operations");
  return { success: true };
}

export async function resolveOperationalAlert(formData: FormData) {
  const access = await getAdminSettingsContext();
  if (!access.ok) return { error: access.error };
  const parsed = resolveAlertSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Alerta inválida" };

  const { data: auth } = await access.context.supabase.auth.getUser();
  if (!auth.user) return { error: "No autenticado" };
  const admin = createAdminClient();
  const { data: alert, error: readError } = await admin
    .from("channel_events")
    .select("id, channel, conversation_id")
    .eq("id", parsed.data.alert_event_id)
    .eq("clinic_id", access.context.clinicId)
    .eq("provider", "recepia-operations")
    .eq("event_type", "operational.alert")
    .maybeSingle();
  if (readError || !alert) return { error: "Alerta no encontrada" };

  const resolvedAt = new Date().toISOString();
  const { error } = await admin.from("channel_events").insert({
    clinic_id: access.context.clinicId,
    conversation_id: alert.conversation_id,
    channel: alert.channel,
    provider: "recepia-operations",
    event_id: `alert-resolved:${alert.id}`,
    event_type: "operational.alert.resolved",
    status: "completed",
    payload: {
      alert_event_id: alert.id,
      resolved_by: auth.user.id,
      resolved_at: resolvedAt,
    },
    occurred_at: resolvedAt,
    processed_at: resolvedAt,
  });
  if (error && error.code !== "23505") {
    console.error("[resolveOperationalAlert]", error);
    return { error: "No se pudo resolver la alerta" };
  }

  revalidatePath("/settings/operations");
  return { success: true };
}
