import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { getExplicitAppointmentConfirmation } from "@/lib/agent/appointment-confirmation";
import {
  ensureVapiCall,
  resolveVapiChannel,
  vapiAssistantResponse,
  vapiWebhookSchema,
} from "@/lib/channels/vapi";
import {
  extractVapiToolCalls,
  isFinalVapiTranscript,
  vapiConfirmationConversation,
  vapiOccurredAt,
} from "@/lib/channels/vapi-payload";
import { handleVapiToolCalls, type VapiFunctionCall } from "@/lib/channels/vapi-tools";
import { operationalErrorCode, operationalLog } from "@/lib/operational-logger";
import { createAdminClient } from "@/lib/supabase/admin";

function secureEqual(actual: string | null, expected: string): boolean {
  if (!actual) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function persistVapiEvent(payload: unknown) {
  const webhook = vapiWebhookSchema.parse(payload);
  const supabaseAdmin = createAdminClient();
  const channel = await resolveVapiChannel(supabaseAdmin, webhook);
  const { conversation, callSession } = await ensureVapiCall(supabaseAdmin, channel, webhook);
  const { message } = webhook;
  const eventId = `${message.call.id}:${message.type}:${message.timestamp ?? message.status ?? message.endedReason ?? "event"}`;
  const { error: eventError } = await supabaseAdmin.from("channel_events").insert({
    clinic_id: channel.clinic_id,
    conversation_id: conversation.id,
    channel: "phone",
    provider: "vapi",
    event_id: eventId,
    event_type: message.type,
    status: "completed",
    payload: JSON.parse(JSON.stringify(payload)),
    occurred_at: vapiOccurredAt(message.timestamp),
    processed_at: new Date().toISOString(),
  });
  if (eventError && eventError.code !== "23505") throw eventError;

  if (isFinalVapiTranscript(message.type, message.transcriptType) && message.transcript) {
    const sender = message.role === "user" ? "client" : "agent";
    const { error: messageError } = await supabaseAdmin.from("messages").insert({
      clinic_id: channel.clinic_id,
      conversation_id: conversation.id,
      direction: sender === "client" ? "inbound" : "outbound",
      sender,
      content_type: "text",
      content: message.transcript,
      provider_message_id: `vapi:${eventId}`,
      metadata: { source: "live_transcript" },
    });
    if (messageError && messageError.code !== "23505") throw messageError;
  }

  if (message.type === "end-of-call-report") {
    const endedAt = message.call.endedAt ?? new Date().toISOString();
    const startedAt = new Date(callSession.started_at).getTime();
    const durationSeconds = Math.max(
      0,
      Math.round((new Date(endedAt).getTime() - startedAt) / 1000),
    );
    const recordingUrl =
      message.artifact?.recording?.stereoUrl ?? message.artifact?.recording?.url ?? null;
    await supabaseAdmin
      .from("call_sessions")
      .update({
        status: message.endedReason?.includes("transfer") ? "transferred" : "completed",
        ended_at: endedAt,
        duration_seconds: durationSeconds,
        transcript_status: message.artifact?.transcript ? "completed" : "not_available",
        metadata: {
          ended_reason: message.endedReason ?? "unknown",
          recording_url: recordingUrl,
          transcript: message.artifact?.transcript ?? null,
        },
      })
      .eq("id", callSession.id);
    await supabaseAdmin
      .from("conversations")
      .update({ status: "completed", ended_at: endedAt })
      .eq("id", conversation.id);
  }
}

export async function POST(request: Request) {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Webhook no configurado" }, { status: 503 });
  const supplied = request.headers.get("x-vapi-secret") ?? request.headers.get("authorization");
  if (!secureEqual(supplied, secret) && !secureEqual(supplied, `Bearer ${secret}`)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = vapiWebhookSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: "Payload inválido" }, { status: 400 });

  if (parsed.data.message.type === "assistant-request") {
    const startedAt = Date.now();
    let clinicId: string | undefined;
    let conversationId: string | undefined;
    let callSessionId: string | undefined;
    try {
      const supabaseAdmin = createAdminClient();
      const channel = await resolveVapiChannel(supabaseAdmin, parsed.data);
      const { conversation, callSession } = await ensureVapiCall(
        supabaseAdmin,
        channel,
        parsed.data,
      );
      clinicId = channel.clinic_id;
      conversationId = conversation.id;
      callSessionId = callSession.id;
      const response = await vapiAssistantResponse(supabaseAdmin, channel, parsed.data);
      operationalLog("info", "vapi.assistant_request.completed", {
        clinic_id: clinicId,
        conversation_id: conversationId,
        call_session_id: callSessionId,
        channel: "phone",
        provider: "vapi",
        event_id: parsed.data.message.call.id,
        duration_ms: Date.now() - startedAt,
      });
      after(async () => {
        try {
          await persistVapiEvent(payload);
        } catch (error) {
          operationalLog("error", "webhook.failed", {
            clinic_id: clinicId,
            conversation_id: conversationId,
            call_session_id: callSessionId,
            channel: "phone",
            provider: "vapi",
            event_id: parsed.data.message.call.id,
            error_code: operationalErrorCode(error, "VAPI_EVENT_PERSISTENCE_FAILED"),
          });
        }
      });
      return Response.json(response);
    } catch (error) {
      operationalLog("error", "vapi.assistant_request.failed", {
        clinic_id: clinicId,
        conversation_id: conversationId,
        call_session_id: callSessionId,
        channel: "phone",
        provider: "vapi",
        event_id: parsed.data.message.call.id,
        error_code: operationalErrorCode(error, "VAPI_ASSISTANT_REQUEST_FAILED"),
        duration_ms: Date.now() - startedAt,
      });
      return Response.json({
        error: "No puedo iniciar la recepción. Voy a pasarte con el equipo.",
      });
    }
  }

  if (parsed.data.message.type === "tool-calls") {
    const rawCalls: VapiFunctionCall[] = extractVapiToolCalls(payload);
    const startedAt = Date.now();
    let clinicId: string | undefined;
    let conversationId: string | undefined;
    let callSessionId: string | undefined;
    try {
      const supabaseAdmin = createAdminClient();
      const channel = await resolveVapiChannel(supabaseAdmin, parsed.data);
      const { conversation, callSession, caller } = await ensureVapiCall(
        supabaseAdmin,
        channel,
        parsed.data,
      );
      clinicId = channel.clinic_id;
      conversationId = conversation.id;
      callSessionId = callSession.id;
      const confirmationContext = vapiConfirmationConversation(payload);
      const confirmation = confirmationContext.currentUserMessage
        ? getExplicitAppointmentConfirmation(
            confirmationContext.previousMessages,
            confirmationContext.currentUserMessage,
          )
        : null;
      return Response.json(
        await handleVapiToolCalls(channel.clinic_id, conversation.id, rawCalls, {
          callId: parsed.data.message.call.id,
          callSessionId: callSession.id,
          callerPhone: caller || undefined,
          confirmation,
          recentUserMessages: [
            ...confirmationContext.previousMessages.flatMap((turn) =>
              turn.sender === "client" ? [turn.content] : [],
            ),
            ...(confirmationContext.currentUserMessage
              ? [confirmationContext.currentUserMessage]
              : []),
          ].slice(-6),
        }),
      );
    } catch (error) {
      operationalLog("error", "webhook.failed", {
        clinic_id: clinicId,
        conversation_id: conversationId,
        call_session_id: callSessionId,
        channel: "phone",
        provider: "vapi",
        event_id: parsed.data.message.call.id,
        error_code: operationalErrorCode(error, "VAPI_TOOL_CALLS_FAILED"),
        duration_ms: Date.now() - startedAt,
      });
      // Devolver un error por cada tool-call para que el LLM lo comunique
      // en vez de quedarse colgado.
      return Response.json({
        results: rawCalls.map((call) => ({
          name: call.function?.name ?? call.name ?? "",
          toolCallId: call.id ?? "",
          result: JSON.stringify({
            success: false,
            error: "No he podido completar la acción. Ofrece pasar con el equipo.",
            error_code: "VAPI_TOOL_CALLS_FAILED",
          }),
        })),
      });
    }
  }

  after(async () => {
    try {
      await persistVapiEvent(payload);
    } catch (error) {
      operationalLog("error", "webhook.failed", {
        channel: "phone",
        provider: "vapi",
        event_id: parsed.data.message.call.id,
        error_code: operationalErrorCode(error, "VAPI_EVENT_PERSISTENCE_FAILED"),
      });
    }
  });
  return Response.json({ received: true });
}
