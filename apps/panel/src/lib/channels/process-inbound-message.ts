import type { InboundChannelEvent } from "@recepia/core";
import type { Database } from "@recepia/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadMessages, saveMessage, startConversation } from "@/lib/agent/conversation-store";
import { runAgentLoop } from "@/lib/agent/loop";

type AdminClient = SupabaseClient<Database>;
type ChannelEventRow = Database["public"]["Tables"]["channel_events"]["Row"];
type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
type JsonValue = Database["public"]["Tables"]["channel_events"]["Insert"]["payload"];

export type ProcessInboundResult = {
  conversationId: string | null;
  response: string | null;
  duplicate: boolean;
  queuedForHuman: boolean;
  terminated: boolean;
};

function jsonPayload(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function eventText(event: InboundChannelEvent): string | null {
  if (event.type !== "message.received") return null;
  if (event.content.kind === "text") return event.content.text;
  if (event.content.kind === "audio") {
    return event.content.transcript?.trim() || "[Audio recibido — pendiente de revisión]";
  }
  return event.content.caption?.trim() || "[Archivo adjunto recibido — pendiente de revisión]";
}

function storedResult(row: ChannelEventRow): ProcessInboundResult {
  const result = row.result as Partial<ProcessInboundResult> | null;
  return {
    conversationId: row.conversation_id,
    response: result?.response ?? null,
    duplicate: true,
    queuedForHuman: result?.queuedForHuman ?? false,
    terminated: result?.terminated ?? false,
  };
}

async function findOpenConversation(
  supabaseAdmin: AdminClient,
  event: InboundChannelEvent,
): Promise<ConversationRow | null> {
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("clinic_id", event.clinicId)
    .eq("channel", event.channel)
    .eq("channel_thread_id", event.externalThreadId)
    .in("status", ["active", "awaiting_human", "human_handling"])
    .is("deleted_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`No se pudo localizar la conversación: ${error.message}`);
  return data;
}

async function completeEvent(
  supabaseAdmin: AdminClient,
  eventRowId: string,
  result: ProcessInboundResult,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("channel_events")
    .update({
      status: "completed",
      result: jsonPayload(result),
      processed_at: new Date().toISOString(),
    })
    .eq("id", eventRowId);

  if (error) throw new Error(`No se pudo cerrar el evento de canal: ${error.message}`);
}

export async function processInboundMessage(
  supabaseAdmin: AdminClient,
  event: InboundChannelEvent,
): Promise<ProcessInboundResult> {
  if (event.type !== "message.received") {
    throw new Error(`Evento no soportado por el procesador de mensajes: ${event.type}`);
  }

  const text = eventText(event);
  if (!text) {
    throw new Error("El mensaje no contiene texto ni una transcripción utilizable.");
  }

  const { data: insertedEvent, error: eventError } = await supabaseAdmin
    .from("channel_events")
    .insert({
      clinic_id: event.clinicId,
      channel: event.channel,
      provider: event.provider,
      event_id: event.eventId,
      event_type: event.type,
      payload: jsonPayload(event),
      occurred_at: event.occurredAt,
    })
    .select("*")
    .single();

  let eventRow = insertedEvent;
  if (eventError) {
    if (eventError.code === "23505") {
      const { data: duplicate } = await supabaseAdmin
        .from("channel_events")
        .select("*")
        .eq("clinic_id", event.clinicId)
        .eq("provider", event.provider)
        .eq("event_id", event.eventId)
        .maybeSingle();

      if (duplicate?.status !== "failed") {
        if (duplicate) return storedResult(duplicate);
      } else {
        const { data: reclaimed } = await supabaseAdmin
          .from("channel_events")
          .update({
            status: "processing",
            payload: jsonPayload(event),
            error_message: null,
            result: null,
            processed_at: null,
          })
          .eq("id", duplicate.id)
          .eq("status", "failed")
          .select("*")
          .maybeSingle();

        if (reclaimed) {
          eventRow = reclaimed;
        } else {
          const { data: claimedByAnotherRequest } = await supabaseAdmin
            .from("channel_events")
            .select("*")
            .eq("id", duplicate.id)
            .single();
          if (claimedByAnotherRequest) return storedResult(claimedByAnotherRequest);
        }
      }
    }
    if (!eventRow) {
      throw new Error(`No se pudo registrar el evento de canal: ${eventError.message}`);
    }
  }

  if (!eventRow) throw new Error("No se pudo reclamar el evento de canal");

  try {
    let conversation = await findOpenConversation(supabaseAdmin, event);
    if (!conversation) {
      conversation = (await startConversation(
        supabaseAdmin,
        event.clinicId,
        event.channel,
        event.contact.phone,
        event.externalThreadId,
      )) as ConversationRow;
    }

    await supabaseAdmin
      .from("channel_events")
      .update({ conversation_id: conversation.id })
      .eq("id", eventRow.id);

    const providerMessageId = `${event.provider}:${event.externalMessageId}`;
    const requiresMediaReview = event.content.kind !== "text";
    if (
      requiresMediaReview ||
      conversation.status === "awaiting_human" ||
      conversation.status === "human_handling"
    ) {
      await saveMessage(supabaseAdmin, {
        conversationId: conversation.id,
        clinicId: event.clinicId,
        direction: "inbound",
        sender: "client",
        content: text,
        contentType:
          event.content.kind === "audio"
            ? "audio"
            : event.content.kind === "attachment" && event.content.mimeType.startsWith("image/")
              ? "image"
              : "document",
        metadata:
          event.content.kind === "text"
            ? undefined
            : {
                provider_media_id: event.content.mediaId,
                mime_type: event.content.mimeType,
                requires_human_review: true,
              },
        providerMessageId,
      });

      if (requiresMediaReview && conversation.status === "active") {
        await supabaseAdmin
          .from("conversations")
          .update({ status: "awaiting_human" })
          .eq("id", conversation.id);
      }

      const queuedResult: ProcessInboundResult = {
        conversationId: conversation.id,
        response: null,
        duplicate: false,
        queuedForHuman: true,
        terminated: false,
      };
      await completeEvent(supabaseAdmin, eventRow.id, queuedResult);
      return queuedResult;
    }

    const previousMessages = await loadMessages(supabaseAdmin, conversation.id);
    const agentResult = await runAgentLoop({
      conversationId: conversation.id,
      clinicId: event.clinicId,
      userMessage: text,
      previousMessages,
      clientPhone: event.contact.phone,
      inboundProviderMessageId: providerMessageId,
      supabaseAdmin,
    });

    const result: ProcessInboundResult = {
      conversationId: conversation.id,
      response: agentResult.response,
      duplicate: false,
      queuedForHuman: false,
      terminated: agentResult.terminated,
    };
    await completeEvent(supabaseAdmin, eventRow.id, result);
    return result;
  } catch (error) {
    await supabaseAdmin
      .from("channel_events")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Error desconocido",
        processed_at: new Date().toISOString(),
      })
      .eq("id", eventRow.id);
    throw error;
  }
}
