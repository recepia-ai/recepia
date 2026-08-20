"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const e164 = z
  .string()
  .trim()
  .regex(/^\+[1-9][0-9]{6,14}$/, "Usa formato +34…");
const whatsappSchema = z
  .object({
    provider: z.enum(["meta_cloud", "360dialog"]),
    identifier: e164,
    phone_number_id: z.string().trim().min(1),
    waba_id: z.string().trim().optional(),
    graph_api_version: z.string().trim().optional(),
    api_key: z.string().trim().min(8),
  })
  .superRefine((value, context) => {
    if (value.provider === "meta_cloud" && !/^v\d+\.\d+$/.test(value.graph_api_version ?? "")) {
      context.addIssue({
        code: "custom",
        path: ["graph_api_version"],
        message: "Indica la versión que muestra Meta, por ejemplo v23.0",
      });
    }
  });
const phoneSchema = z.object({
  identifier: e164,
  vapi_phone_number_id: z.string().trim().min(1),
  assistant_id: z.string().trim().min(1),
  transfer_number: e164,
  api_key: z.string().trim().min(8),
});

export type ChannelSettings = {
  whatsapp?: {
    provider: "meta_cloud" | "360dialog";
    identifier: string;
    phoneNumberId?: string;
    wabaId?: string;
    graphApiVersion?: string;
    status: string;
    hasSecret: boolean;
  };
  phone?: {
    identifier: string;
    phoneNumberId?: string;
    assistantId?: string;
    transferNumber?: string;
    status: string;
    hasSecret: boolean;
  };
};

async function adminClinic() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "No autenticado" as const };
  const { data } = await supabase
    .from("clinic_users")
    .select("clinic_id, role")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (data?.role !== "admin") {
    return { error: "Solo el administrador puede configurar canales" as const };
  }
  return { clinicId: data.clinic_id };
}

function config(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function writeVaultSecret(
  clinicId: string,
  provider: string,
  apiKey: string,
  currentId?: string | null,
) {
  const admin = createAdminClient();
  const name = `${provider}_clinic_${clinicId}`;
  const description = `${provider} API key — clinic ${clinicId}`;
  if (currentId) {
    const { error } = await admin.rpc("vault_update_secret", {
      p_id: currentId,
      p_secret: JSON.stringify(
        provider === "meta_cloud" ? { access_token: apiKey } : { api_key: apiKey },
      ),
      p_name: name,
      p_description: description,
    });
    if (error) throw error;
    return currentId;
  }
  const { data, error } = await admin.rpc("vault_create_secret", {
    p_secret: JSON.stringify(
      provider === "meta_cloud" ? { access_token: apiKey } : { api_key: apiKey },
    ),
    p_name: name,
    p_description: description,
  });
  if (error || !data) throw error ?? new Error("Vault no devolvió un identificador");
  return data as string;
}

export async function getChannelSettings(): Promise<ChannelSettings> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return {};
  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinic_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!clinicUser) return {};
  const { data: channels } = await supabase
    .from("clinic_channels")
    .select("channel_type, identifier, provider, provider_config, status, vault_secret_id")
    .eq("clinic_id", clinicUser.clinic_id);

  const whatsappChannels = channels?.filter((item) => item.channel_type === "whatsapp") ?? [];
  const whatsapp = whatsappChannels.find((item) => item.status === "active") ?? whatsappChannels[0];
  const phone = channels?.find((item) => item.channel_type === "phone" && item.provider === "vapi");
  const whatsappConfig = config(whatsapp?.provider_config);
  const phoneConfig = config(phone?.provider_config);
  return {
    whatsapp: whatsapp
      ? {
          provider: whatsapp.provider === "meta_cloud" ? "meta_cloud" : "360dialog",
          identifier: whatsapp.identifier,
          phoneNumberId: whatsappConfig.phone_number_id as string | undefined,
          wabaId: whatsappConfig.waba_id as string | undefined,
          graphApiVersion: whatsappConfig.graph_api_version as string | undefined,
          status: whatsapp.status,
          hasSecret: Boolean(whatsapp.vault_secret_id),
        }
      : undefined,
    phone: phone
      ? {
          identifier: phone.identifier,
          phoneNumberId: phoneConfig.vapi_phone_number_id as string | undefined,
          assistantId: phoneConfig.assistant_id as string | undefined,
          transferNumber: phoneConfig.transfer_number as string | undefined,
          status: phone.status,
          hasSecret: Boolean(phone.vault_secret_id),
        }
      : undefined,
  };
}

export async function saveWhatsAppChannel(formData: FormData) {
  const access = await adminClinic();
  if ("error" in access) return { error: access.error };
  const parsed = whatsappSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const admin = createAdminClient();
  const { data: existingChannels, error: existingError } = await admin
    .from("clinic_channels")
    .select("id, vault_secret_id")
    .eq("clinic_id", access.clinicId)
    .eq("channel_type", "whatsapp");
  if (existingError) return { error: "No se pudo leer la configuración de WhatsApp" };
  const current =
    existingChannels?.find((item) => item.id && item.vault_secret_id) ?? existingChannels?.[0];
  try {
    const vaultId = await writeVaultSecret(
      access.clinicId,
      parsed.data.provider,
      parsed.data.api_key,
      current?.vault_secret_id,
    );
    const values = {
      clinic_id: access.clinicId,
      channel_type: "whatsapp" as const,
      identifier: parsed.data.identifier,
      provider: parsed.data.provider,
      provider_config: {
        phone_number_id: parsed.data.phone_number_id,
        waba_id: parsed.data.waba_id || null,
        graph_api_version:
          parsed.data.provider === "meta_cloud" ? parsed.data.graph_api_version : null,
      },
      vault_secret_id: vaultId,
      status: "active" as const,
    };
    const { data: saved, error } = current
      ? await admin
          .from("clinic_channels")
          .update(values)
          .eq("id", current.id)
          .select("id")
          .single()
      : await admin.from("clinic_channels").insert(values).select("id").single();
    if (error) throw error;
    const { error: pauseError } = await admin
      .from("clinic_channels")
      .update({ status: "paused" })
      .eq("clinic_id", access.clinicId)
      .eq("channel_type", "whatsapp")
      .neq("id", saved.id);
    if (pauseError) throw pauseError;
    revalidatePath("/settings/integrations");
    return { success: true };
  } catch (error) {
    console.error("[saveWhatsAppChannel]", error);
    return { error: "No se pudo guardar el canal de WhatsApp" };
  }
}

export async function savePhoneChannel(formData: FormData) {
  const access = await adminClinic();
  if ("error" in access) return { error: access.error };
  const parsed = phoneSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const admin = createAdminClient();
  const { data: current } = await admin
    .from("clinic_channels")
    .select("id, vault_secret_id")
    .eq("clinic_id", access.clinicId)
    .eq("channel_type", "phone")
    .eq("provider", "vapi")
    .maybeSingle();
  try {
    const vaultId = await writeVaultSecret(
      access.clinicId,
      "vapi",
      parsed.data.api_key,
      current?.vault_secret_id,
    );
    const values = {
      clinic_id: access.clinicId,
      channel_type: "phone" as const,
      identifier: parsed.data.identifier,
      provider: "vapi",
      provider_config: {
        vapi_phone_number_id: parsed.data.vapi_phone_number_id,
        assistant_id: parsed.data.assistant_id,
        transfer_number: parsed.data.transfer_number,
      },
      vault_secret_id: vaultId,
      status: "active" as const,
    };
    const { error } = current
      ? await admin.from("clinic_channels").update(values).eq("id", current.id)
      : await admin.from("clinic_channels").insert(values);
    if (error) throw error;
    revalidatePath("/settings/integrations");
    return { success: true };
  } catch (error) {
    console.error("[savePhoneChannel]", error);
    return { error: "No se pudo guardar el canal telefónico" };
  }
}
