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
