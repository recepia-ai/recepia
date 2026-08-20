"use server";

import { revalidatePath } from "next/cache";
import {
  resolveClinic360DialogChannel,
  send360DialogText,
} from "@/lib/channels/whatsapp-360dialog";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  type ReturnToAgentState,
  returnToAgentSchema,
  type SendMessageState,
  sendMessageSchema,
  type TakeControlState,
  takeControlSchema,
} from "./conversation-schema";

// ---------------------------------------------------------------------------
// takeControl — sets status to human_handling
// ---------------------------------------------------------------------------

export async function takeControl(
  _prevState: TakeControlState,
  formData: FormData,
): Promise<TakeControlState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // formData.get() can return FormDataEntryValue which may not survive
  // Next.js Server Action serialization as a plain string. Coerce explicitly.
  const rawId = formData.get("conversation_id");
  const conversationIdStr = typeof rawId === "string" ? rawId : String(rawId ?? "");

  const parsed = takeControlSchema.safeParse({
    conversation_id: conversationIdStr,
  });

  if (!parsed.success) {
    console.error("[takeControl] parse error:", {
      rawId,
      rawType: typeof rawId,
      rawValue: String(rawId),
      issues: parsed.error.issues,
    });
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { conversation_id } = parsed.data;

  // Verify user belongs to the conversation's clinic
  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinic_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!clinicUser) return { error: "Sin clínica asignada" };

  const { data: convGuard } = await supabase
    .from("conversations")
    .select("id, channel")
    .eq("id", conversation_id)
    .eq("clinic_id", clinicUser.clinic_id)
    .maybeSingle();

  if (!convGuard) return { error: "Conversación no encontrada" };
  if (convGuard.channel === "phone") {
    return { error: "Las llamadas se transfieren al equipo; no admiten control por chat." };
  }

  const { data: updated, error } = await supabase
    .from("conversations")
    .update({
      status: "human_handling",
      controlled_by: user.id,
      controlled_at: new Date().toISOString(),
    })
    .eq("id", conversation_id)
    .eq("clinic_id", clinicUser.clinic_id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[takeControl]", error);
    return { error: "Error al tomar el control. Intenta de nuevo." };
  }

  if (!updated) {
    return { error: "No tienes permiso para tomar el control." };
  }

  revalidatePath(`/conversations/${conversation_id}`);
  revalidatePath("/conversations");
  return { success: true };
}

// ---------------------------------------------------------------------------
// returnToAgent — sets status back to active
// ---------------------------------------------------------------------------

export async function returnToAgent(
  _prevState: ReturnToAgentState,
  formData: FormData,
): Promise<ReturnToAgentState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // formData.get() can return FormDataEntryValue which may not survive
  // Next.js Server Action serialization as a plain string. Coerce explicitly.
  const rawId = formData.get("conversation_id");
  const conversationIdStr = typeof rawId === "string" ? rawId : String(rawId ?? "");

  const parsed = returnToAgentSchema.safeParse({
    conversation_id: conversationIdStr,
  });

  if (!parsed.success) {
    console.error("[returnToAgent] parse error:", {
      rawId,
      rawType: typeof rawId,
      rawValue: String(rawId),
      issues: parsed.error.issues,
    });
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { conversation_id } = parsed.data;

  // Verify user belongs to the conversation's clinic
  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinic_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!clinicUser) return { error: "Sin clínica asignada" };

  const { data: convGuard } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversation_id)
    .eq("clinic_id", clinicUser.clinic_id)
    .maybeSingle();

  if (!convGuard) return { error: "Conversación no encontrada" };

  const { data: updated, error } = await supabase
    .from("conversations")
    .update({
      status: "active",
      controlled_by: null,
      controlled_at: null,
    })
    .eq("id", conversation_id)
    .eq("clinic_id", clinicUser.clinic_id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[returnToAgent]", error);
    return { error: "Error al devolver al agente. Intenta de nuevo." };
  }

  if (!updated) {
    return { error: "No tienes permiso para devolver al agente." };
  }

  revalidatePath(`/conversations/${conversation_id}`);
  revalidatePath("/conversations");
  return { success: true };
}

// ---------------------------------------------------------------------------
// sendMessage — inserts a human-authored message
// ---------------------------------------------------------------------------

export async function sendMessage(
  _prevState: SendMessageState,
  formData: FormData,
): Promise<SendMessageState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // formData.get() can return FormDataEntryValue which may not survive
  // Next.js Server Action serialization as a plain string. Coerce explicitly.
  const rawId = formData.get("conversation_id");
  const rawContent = formData.get("content");
  const conversationIdStr = typeof rawId === "string" ? rawId : String(rawId ?? "");
  const contentStr = typeof rawContent === "string" ? rawContent : String(rawContent ?? "");

  const parsed = sendMessageSchema.safeParse({
    conversation_id: conversationIdStr,
    content: contentStr,
  });

  if (!parsed.success) {
    console.error("[sendMessage] parse error:", {
      rawIdType: typeof rawId,
      rawContentType: typeof rawContent,
      issues: parsed.error.issues,
    });
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { conversation_id, content } = parsed.data;

  // Verify user belongs to the conversation's clinic
  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinic_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!clinicUser) return { error: "Sin clínica asignada" };

  const { data: convGuard } = await supabase
    .from("conversations")
    .select("id, status, channel, channel_thread_id")
    .eq("id", conversation_id)
    .eq("clinic_id", clinicUser.clinic_id)
    .maybeSingle();

  if (!convGuard) return { error: "Conversación no encontrada" };
  if (convGuard.channel === "phone") {
    return { error: "No se pueden enviar mensajes de texto dentro de una llamada." };
  }

  // Only allow sending when the human is in control
  if (convGuard.status !== "human_handling") {
    return { error: "Toma el control primero para enviar mensajes." };
  }

  let providerMessageId: string | undefined;
  let providerMetadata: Record<string, string> = {};
  if (convGuard.channel === "whatsapp") {
    if (!convGuard.channel_thread_id) {
      return { error: "La conversación no tiene destinatario de WhatsApp." };
    }
    try {
      const supabaseAdmin = createAdminClient();
      const channel = await resolveClinic360DialogChannel(supabaseAdmin, clinicUser.clinic_id);
      const sent = await send360DialogText(
        supabaseAdmin,
        channel,
        convGuard.channel_thread_id,
        content,
      );
      providerMessageId = `360dialog:${sent.externalMessageId}`;
      providerMetadata = { delivery_status: "accepted", accepted_at: sent.acceptedAt };
    } catch (error) {
      console.error("[sendMessage] WhatsApp delivery failed", error);
      return { error: "WhatsApp no ha aceptado el mensaje. No se ha marcado como enviado." };
    }
  }

  const { error: insertError } = await supabase.from("messages").insert({
    clinic_id: clinicUser.clinic_id,
    conversation_id,
    content,
    sender: "human",
    direction: "outbound",
    content_type: "text",
    sender_user_id: user.id,
    provider_message_id: providerMessageId,
    metadata: providerMetadata,
  });

  if (insertError) {
    console.error("[sendMessage]", insertError);
    return { error: "Error al enviar el mensaje. Intenta de nuevo." };
  }

  revalidatePath(`/conversations/${conversation_id}`);
  revalidatePath("/conversations");
  return { success: true };
}
