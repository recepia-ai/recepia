"use server";

import type { Database } from "@recepia/db";
import { revalidatePath } from "next/cache";
import { failedWhatsAppDeliveryMetadata } from "@/lib/channels/whatsapp-delivery";
import { resolveClinicWhatsAppChannel, sendWhatsAppText } from "@/lib/channels/whatsapp-provider";
import { resolveOrganizationContext } from "@/lib/organization-context";
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

async function actionContext() {
  const supabase = await createClient();
  const organizationResult = await resolveOrganizationContext(supabase);
  if (!organizationResult.ok) return { error: organizationResult.message };
  return {
    supabase,
    actorId: organizationResult.context.actor.id,
    clinicId: organizationResult.context.organization.id,
  };
}

// ---------------------------------------------------------------------------
// takeControl — sets status to human_handling
// ---------------------------------------------------------------------------

export async function takeControl(
  _prevState: TakeControlState,
  formData: FormData,
): Promise<TakeControlState> {
  const context = await actionContext();
  if ("error" in context) return { error: context.error };
  const { supabase, actorId, clinicId } = context;

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

  const { data: convGuard } = await supabase
    .from("conversations")
    .select("id, channel, status, controlled_by")
    .eq("id", conversation_id)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!convGuard) return { error: "Conversación no encontrada" };
  if (convGuard.channel === "phone") {
    return { error: "Las llamadas se transfieren al equipo; no admiten control por chat." };
  }
  if (convGuard.status === "human_handling") {
    return {
      error:
        convGuard.controlled_by === actorId
          ? "Ya tienes el control de esta conversación."
          : "Otra persona del equipo ya controla esta conversación.",
    };
  }
  if (convGuard.status !== "active" && convGuard.status !== "awaiting_human") {
    return { error: "Esta conversación ya está cerrada y no se puede tomar." };
  }

  const { data: updated, error } = await supabase
    .from("conversations")
    .update({
      status: "human_handling",
      controlled_by: actorId,
      controlled_at: new Date().toISOString(),
    })
    .eq("id", conversation_id)
    .eq("clinic_id", clinicId)
    .in("status", ["active", "awaiting_human"])
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
  const context = await actionContext();
  if ("error" in context) return { error: context.error };
  const { supabase, actorId, clinicId } = context;

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

  const { data: convGuard } = await supabase
    .from("conversations")
    .select("id, status, controlled_by, metadata")
    .eq("id", conversation_id)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!convGuard) return { error: "Conversación no encontrada" };
  if (convGuard.status !== "human_handling") {
    return { error: "La conversación no está bajo control humano." };
  }
  if (convGuard.controlled_by !== actorId) {
    return { error: "Solo la persona que tomó la conversación puede devolverla a la IA." };
  }

  const currentMetadata =
    convGuard.metadata &&
    typeof convGuard.metadata === "object" &&
    !Array.isArray(convGuard.metadata)
      ? (convGuard.metadata as Record<string, unknown>)
      : {};
  const { escalation, ...metadataWithoutActiveEscalation } = currentMetadata;
  const priorHistory = Array.isArray(currentMetadata.escalation_history)
    ? currentMetadata.escalation_history
    : [];
  const resolvedAt = new Date().toISOString();
  const metadata = escalation
    ? {
        ...metadataWithoutActiveEscalation,
        escalation_history: [
          ...priorHistory,
          { escalation, resolved_at: resolvedAt, resolution: "returned_to_agent" },
        ].slice(-20),
        escalation_resolved_at: resolvedAt,
      }
    : currentMetadata;

  const { data: updated, error } = await supabase
    .from("conversations")
    .update({
      status: "active",
      controlled_by: null,
      controlled_at: null,
      metadata: metadata as Database["public"]["Tables"]["conversations"]["Update"]["metadata"],
    })
    .eq("id", conversation_id)
    .eq("clinic_id", clinicId)
    .eq("status", "human_handling")
    .eq("controlled_by", actorId)
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
  const context = await actionContext();
  if ("error" in context) return { error: context.error };
  const { supabase, actorId, clinicId } = context;

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

  const { data: convGuard } = await supabase
    .from("conversations")
    .select("id, status, channel, channel_thread_id, controlled_by")
    .eq("id", conversation_id)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (!convGuard) return { error: "Conversación no encontrada" };
  if (convGuard.channel === "phone") {
    return { error: "No se pueden enviar mensajes de texto dentro de una llamada." };
  }

  // Only allow sending when the human is in control
  if (convGuard.status !== "human_handling") {
    return { error: "Toma el control primero para enviar mensajes." };
  }
  if (convGuard.controlled_by !== actorId) {
    return { error: "Otra persona del equipo tiene el control de esta conversación." };
  }

  if (convGuard.channel === "whatsapp") {
    if (!convGuard.channel_thread_id) {
      return { error: "La conversación no tiene destinatario de WhatsApp." };
    }

    const pendingMetadata = { delivery_status: "sending", source: "operator" };
    const { data: pendingMessage, error: insertError } = await supabase
      .from("messages")
      .insert({
        clinic_id: clinicId,
        conversation_id,
        content,
        sender: "human",
        direction: "outbound",
        content_type: "text",
        sender_user_id: actorId,
        metadata: pendingMetadata,
      })
      .select("id")
      .single();

    if (insertError || !pendingMessage) {
      console.error("[sendMessage] could not persist pending WhatsApp message", insertError);
      return { error: "No se pudo guardar el mensaje, así que no se envió por WhatsApp." };
    }

    try {
      const supabaseAdmin = createAdminClient();
      const channel = await resolveClinicWhatsAppChannel(supabaseAdmin, clinicId);
      const sent = await sendWhatsAppText(
        supabaseAdmin,
        channel,
        convGuard.channel_thread_id,
        content,
      );
      const { error: updateError } = await supabase
        .from("messages")
        .update({
          provider_message_id: `${channel.provider}:${sent.externalMessageId}`,
          metadata: {
            ...pendingMetadata,
            delivery_status: "accepted",
            accepted_at: sent.acceptedAt,
          },
        })
        .eq("id", pendingMessage.id)
        .eq("clinic_id", clinicId);

      if (updateError) {
        console.error("[sendMessage] WhatsApp accepted but status update failed", updateError);
        return {
          error:
            "WhatsApp aceptó el mensaje, pero no se pudo actualizar su estado. Recarga la conversación.",
        };
      }
    } catch (error) {
      console.error("[sendMessage] WhatsApp delivery failed", error);
      await supabase
        .from("messages")
        .update({
          metadata: failedWhatsAppDeliveryMetadata(
            pendingMetadata,
          ) as Database["public"]["Tables"]["messages"]["Update"]["metadata"],
        })
        .eq("id", pendingMessage.id)
        .eq("clinic_id", clinicId);
      return { error: "WhatsApp no ha aceptado el mensaje. No se ha marcado como enviado." };
    }

    revalidatePath(`/conversations/${conversation_id}`);
    revalidatePath("/conversations");
    return { success: true };
  }

  const { error: insertError } = await supabase.from("messages").insert({
    clinic_id: clinicId,
    conversation_id,
    content,
    sender: "human",
    direction: "outbound",
    content_type: "text",
    sender_user_id: actorId,
    metadata: {},
  });

  if (insertError) {
    console.error("[sendMessage]", insertError);
    return { error: "Error al enviar el mensaje. Intenta de nuevo." };
  }

  revalidatePath(`/conversations/${conversation_id}`);
  revalidatePath("/conversations");
  return { success: true };
}
