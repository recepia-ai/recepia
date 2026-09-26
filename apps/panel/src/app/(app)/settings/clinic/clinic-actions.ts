"use server";

import { revalidatePath } from "next/cache";
import { clinicAgentConfigFromData, mergeClinicAgentConfig } from "@/lib/clinic-agent-config";
import { createClient } from "@/lib/supabase/server";
import { type ClinicFormState, clinicSchema } from "./clinic-schema";

type ClinicUserRow = { clinic_id: string; role: string };

export async function updateClinic(
  _prevState: ClinicFormState,
  formData: FormData,
): Promise<ClinicFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // Solo admins pueden editar la clínica
  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinic_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  const cu = clinicUser as ClinicUserRow | null;
  if (!cu) return { error: "Sin clínica asignada" };
  if (cu.role !== "admin") return { error: "Solo el administrador puede editar la clínica" };

  const raw = {
    name: formData.get("name"),
    slug: formData.get("slug"),
    legal_name: formData.get("legal_name"),
    tax_id: formData.get("tax_id"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address_street: formData.get("address_street"),
    address_city: formData.get("address_city"),
    address_postal_code: formData.get("address_postal_code"),
    address_country: formData.get("address_country"),
    locale: formData.get("locale"),
    timezone: formData.get("timezone"),
    public_name: formData.get("public_name"),
    agent_name: formData.get("agent_name"),
    primary_language: formData.get("primary_language"),
    web_greeting: formData.get("web_greeting"),
    whatsapp_greeting: formData.get("whatsapp_greeting"),
    voice_greeting: formData.get("voice_greeting"),
    after_hours_message: formData.get("after_hours_message"),
    human_fallback_message: formData.get("human_fallback_message"),
    escalation_rules: formData.get("escalation_rules"),
  };

  const parsed = clinicSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  // Empty strings -> null para campos opcionales
  // Campos con default se mantienen si están vacíos (locales, tz, country)
  const payload = {
    name: parsed.data.name,
    slug: parsed.data.slug,
    legal_name: parsed.data.legal_name || null,
    tax_id: parsed.data.tax_id || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    address_street: parsed.data.address_street || null,
    address_city: parsed.data.address_city || null,
    address_postal_code: parsed.data.address_postal_code || null,
    address_country: parsed.data.address_country || "ES",
    locale: parsed.data.locale || "es-ES",
    timezone: parsed.data.timezone || "Europe/Madrid",
  };

  const query = supabase.from("clinics") as any;
  const { data: updated, error } = await query
    .update(payload)
    .eq("id", cu.clinic_id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[updateClinic]", error);
    return { error: "Error al guardar. Intenta de nuevo." };
  }

  if (!updated) {
    console.error("[updateClinic] UPDATE affected 0 rows. RLS policy missing?");
    return { error: "No tienes permiso para editar la clínica." };
  }

  const { data: existingConfig } = await supabase
    .from("clinic_config")
    .select("config")
    .eq("clinic_id", cu.clinic_id)
    .maybeSingle();
  const current = clinicAgentConfigFromData(
    {
      name: parsed.data.name,
      locale: parsed.data.locale || "es-ES",
      timezone: parsed.data.timezone || "Europe/Madrid",
    },
    existingConfig?.config,
  );
  const config = mergeClinicAgentConfig(existingConfig?.config, {
    ...current,
    publicName: parsed.data.public_name,
    agentName: parsed.data.agent_name,
    primaryLanguage: parsed.data.primary_language,
    greetings: {
      web: parsed.data.web_greeting,
      whatsapp: parsed.data.whatsapp_greeting,
      voice: parsed.data.voice_greeting,
    },
    afterHoursMessage: parsed.data.after_hours_message,
    humanFallbackMessage: parsed.data.human_fallback_message,
    escalationRules: parsed.data.escalation_rules
      .split("\n")
      .map((rule) => rule.trim())
      .filter(Boolean),
    recordingEnabled: false,
  });
  const { error: configError } = await supabase.from("clinic_config").upsert({
    clinic_id: cu.clinic_id,
    config,
    updated_by: user.id,
  });
  if (configError) {
    console.error("[updateClinic] clinic_config", configError);
    return { error: "La clínica se actualizó, pero no su configuración del agente." };
  }

  revalidatePath("/settings/clinic");
  revalidatePath("/", "layout"); // sidebar refresca nombre de clínica
  return { success: true };
}
