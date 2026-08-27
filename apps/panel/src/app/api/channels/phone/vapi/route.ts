import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import {
  ensureVapiCall,
  resolveVapiChannel,
  vapiAssistantResponse,
  vapiWebhookSchema,
} from "@/lib/channels/vapi";
import {
  handleVapiToolCalls,
  type VapiFunctionCall,
} from "@/lib/channels/vapi-tools";
import { createAdminClient } from "@/lib/supabase/admin";

function extractToolCalls(payload: unknown): VapiFunctionCall[] {
  const message = (payload as { message?: Record<string, unknown> })?.message;
  const list = message?.toolCallList ?? message?.toolCalls;
  return Array.isArray(list) ? (list as VapiFunctionCall[]) : [];
}

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
    occurred_at: message.timestamp ?? new Date().toISOString(),
    processed_at: new Date().toISOString(),
  });
  if (eventError && eventError.code !== "23505") throw eventError;

  if (message.type === "transcript" && message.transcriptType === "final" && message.transcript) {
    const sender = message.role === "user" ? "client" : "agent";
    await supabaseAdmin.from("messages").upsert(
      {
        clinic_id: channel.clinic_id,
        conversation_id: conversation.id,
        direction: sender === "client" ? "inbound" : "outbound",
        sender,
        content_type: "text",
        content: message.transcript,
        provider_message_id: `vapi:${eventId}`,
        metadata: { source: "live_transcript" },
      },
      { onConflict: "clinic_id,provider_message_id", ignoreDuplicates: true },
    );
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
    try {
      const supabaseAdmin = createAdminClient();
      const channel = await resolveVapiChannel(supabaseAdmin, parsed.data);
      await ensureVapiCall(supabaseAdmin, channel, parsed.data);
      return Response.json(await vapiAssistantResponse(supabaseAdmin, channel, parsed.data));
    } catch (error) {
      console.error("[vapi] assistant request failed", error);
      return Response.json({
        error: "No puedo iniciar la recepción. Voy a pasarte con el equipo.",
      });
    }
  }

  if (parsed.data.message.type === "tool-calls") {
    const rawCalls = extractToolCalls(payload);
    try {
      const supabaseAdmin = createAdminClient();
      const channel = await resolveVapiChannel(supabaseAdmin, parsed.data);
      const { conversation } = await ensureVapiCall(supabaseAdmin, channel, parsed.data);
      return Response.json(
        await handleVapiToolCalls(channel.clinic_id, conversation.id, rawCalls),
      );
    } catch (error) {
      console.error("[vapi] tool-calls failed", error);
      // Devolver un error por cada tool-call para que el LLM lo comunique
      // en vez de quedarse colgado.
      return Response.json({
        results: rawCalls.map((call) => ({
          toolCallId: call.id ?? "",
          result: JSON.stringify({
            success: false,
            error: "No he podido completar la acción. Ofrece pasar con el equipo.",
          }),
        })),
      });
    }
  }

  after(async () => {
    try {
      await persistVapiEvent(payload);
    } catch (error) {
      console.error("[vapi] event processing failed", error);
    }
  });
  return Response.json({ received: true });
}
