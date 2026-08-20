import type { Database } from "@recepia/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { startConversation } from "@/lib/agent/conversation-store";

type AdminClient = SupabaseClient<Database>;
type ChannelRow = Database["public"]["Tables"]["clinic_channels"]["Row"];
type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];

const partySchema = z
  .object({ number: z.string().optional(), phoneNumber: z.string().optional() })
  .passthrough();

export const vapiWebhookSchema = z.object({
  message: z
    .object({
      type: z.string().min(1),
      timestamp: z.string().optional(),
      status: z.string().optional(),
      endedReason: z.string().optional(),
      transcript: z.string().optional(),
      transcriptType: z.string().optional(),
      role: z.string().optional(),
      call: z
        .object({
          id: z.string().min(1),
          startedAt: z.string().optional(),
          endedAt: z.string().optional(),
          phoneNumberId: z.string().optional(),
          customer: partySchema.optional(),
          phoneNumber: partySchema.optional(),
        })
        .passthrough(),
      customer: partySchema.optional(),
      phoneNumber: partySchema.optional(),
      artifact: z
        .object({
          transcript: z.string().optional(),
          recording: z
            .object({ url: z.string().url().optional(), stereoUrl: z.string().url().optional() })
            .passthrough()
            .optional(),
        })
        .passthrough()
        .optional(),
    })
    .passthrough(),
});

export type VapiWebhook = z.infer<typeof vapiWebhookSchema>;

function objectConfig(value: ChannelRow["provider_config"]): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizePhone(value?: string): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

export function callParties(webhook: VapiWebhook) {
  const { message } = webhook;
  const caller = normalizePhone(
    message.call.customer?.number ??
      message.call.customer?.phoneNumber ??
      message.customer?.number ??
      message.customer?.phoneNumber,
  );
  const called = normalizePhone(
    message.call.phoneNumber?.number ??
      message.call.phoneNumber?.phoneNumber ??
      message.phoneNumber?.number ??
      message.phoneNumber?.phoneNumber,
  );
  return { caller, called };
}

export async function resolveVapiChannel(
  supabaseAdmin: AdminClient,
  webhook: VapiWebhook,
): Promise<ChannelRow> {
  const { data, error } = await supabaseAdmin
    .from("clinic_channels")
    .select("*")
    .eq("channel_type", "phone")
    .eq("provider", "vapi")
    .eq("status", "active");
  if (error) throw new Error(`No se pudo resolver el canal telefónico: ${error.message}`);

  const { called } = callParties(webhook);
  const channel = (data ?? []).find((candidate) => {
    const config = objectConfig(candidate.provider_config);
    return (
      config.vapi_phone_number_id === webhook.message.call.phoneNumberId ||
      normalizePhone(candidate.identifier) === called
    );
  });
  if (!channel) throw new Error("No hay un canal Vapi activo para esta llamada");
  return channel;
}

export async function ensureVapiCall(
  supabaseAdmin: AdminClient,
  channel: ChannelRow,
  webhook: VapiWebhook,
) {
  const callId = webhook.message.call.id;
  const { caller, called } = callParties(webhook);
  const { data: existingConversation } = await supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("clinic_id", channel.clinic_id)
    .eq("channel", "phone")
    .eq("channel_thread_id", callId)
    .is("deleted_at", null)
    .maybeSingle();
  let conversation: ConversationRow | null = existingConversation;

  if (!conversation) {
    conversation = (await startConversation(
      supabaseAdmin,
      channel.clinic_id,
      "phone",
      caller || undefined,
      callId,
    )) as unknown as ConversationRow;
  }
  if (!conversation) throw new Error("No se pudo crear la conversación telefónica");

  const status = webhook.message.status;
  const mappedStatus =
    status === "in-progress"
      ? "in_progress"
      : status === "ringing"
        ? "ringing"
        : status === "queued" || status === "scheduled"
          ? "queued"
          : status === "ended"
            ? "completed"
            : null;

  const { data: existingCall } = await supabaseAdmin
    .from("call_sessions")
    .select("*")
    .eq("provider", "vapi")
    .eq("provider_call_id", callId)
    .maybeSingle();
  if (existingCall) {
    if (!mappedStatus) return { conversation, callSession: existingCall, caller, called };
    const { data: updatedCall, error: updateError } = await supabaseAdmin
      .from("call_sessions")
      .update({
        status: mappedStatus,
        answered_at:
          mappedStatus === "in_progress"
            ? (existingCall.answered_at ?? new Date().toISOString())
            : existingCall.answered_at,
      })
      .eq("id", existingCall.id)
      .select("*")
      .single();
    if (updateError) throw new Error(`No se pudo actualizar la llamada: ${updateError.message}`);
    return { conversation, callSession: updatedCall, caller, called };
  }

  const { data: callSession, error } = await supabaseAdmin
    .from("call_sessions")
    .insert({
      clinic_id: channel.clinic_id,
      conversation_id: conversation.id,
      provider: "vapi",
      provider_call_id: callId,
      direction: "inbound",
      status: mappedStatus ?? "ringing",
      from_number: caller || null,
      to_number: called || channel.identifier,
      started_at: webhook.message.call.startedAt ?? new Date().toISOString(),
      answered_at: mappedStatus === "in_progress" ? new Date().toISOString() : null,
    })
    .select("*")
    .single();
  if (error) throw new Error(`No se pudo registrar la llamada: ${error.message}`);
  return { conversation, callSession, caller, called };
}

export async function vapiAssistantResponse(
  supabaseAdmin: AdminClient,
  channel: ChannelRow,
  webhook: VapiWebhook,
) {
  const config = objectConfig(channel.provider_config);
  const assistantId = typeof config.assistant_id === "string" ? config.assistant_id : null;
  if (!assistantId) throw new Error("El canal telefónico no tiene assistant_id de Vapi");
  const { caller } = callParties(webhook);

  const { data: clinic } = await supabaseAdmin
    .from("clinics")
    .select("name")
    .eq("id", channel.clinic_id)
    .single();
  const { data: client } = caller
    ? await supabaseAdmin
        .from("clients")
        .select("id, name, phone")
        .eq("clinic_id", channel.clinic_id)
        .eq("phone", caller)
        .is("deleted_at", null)
        .maybeSingle()
    : { data: null };

  const [{ data: pets }, { data: appointments }] = client
    ? await Promise.all([
        supabaseAdmin.from("pets").select("name, species").eq("client_id", client.id),
        supabaseAdmin
          .from("appointments")
          .select("starts_at, status, notes")
          .eq("client_id", client.id)
          .gte("starts_at", new Date().toISOString())
          .order("starts_at")
          .limit(10),
      ])
    : [{ data: [] }, { data: [] }];

  return {
    assistantId,
    assistantOverrides: {
      variableValues: {
        clinicName: clinic?.name ?? "el hospital veterinario",
        customerPhone: caller || "no disponible",
        customerName: client?.name ?? "cliente no identificado",
        customerContext: JSON.stringify({ pets: pets ?? [], appointments: appointments ?? [] }),
        humanTransferNumber:
          typeof config.transfer_number === "string" ? config.transfer_number : "",
      },
    },
  };
}
