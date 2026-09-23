import type { Database } from "@recepia/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
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
      timestamp: z.union([z.string(), z.number()]).optional(),
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
    const { data: existingConversation, error: conversationError } = await supabaseAdmin
      .from("conversations")
      .select("*")
      .eq("id", existingCall.conversation_id)
      .eq("clinic_id", channel.clinic_id)
      .single();
    if (conversationError || !existingConversation) {
      throw new Error("La llamada existe, pero su conversación canónica no está disponible");
    }
    const conversation = existingConversation as ConversationRow;
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

  const { data: existingConversations, error: existingConversationError } = await supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("clinic_id", channel.clinic_id)
    .eq("channel", "phone")
    .eq("channel_thread_id", callId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1);
  if (existingConversationError) {
    throw new Error(
      `No se pudo resolver la conversación telefónica: ${existingConversationError.message}`,
    );
  }
  let conversation: ConversationRow | null =
    (existingConversations?.[0] as ConversationRow | undefined) ?? null;

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
  if (error?.code === "23505") {
    const { data: racedCall, error: racedCallError } = await supabaseAdmin
      .from("call_sessions")
      .select("*")
      .eq("provider", "vapi")
      .eq("provider_call_id", callId)
      .single();
    if (racedCallError || !racedCall) {
      throw new Error("Otra petición registró la llamada, pero no se pudo recuperar");
    }
    const { data: canonicalConversation, error: canonicalError } = await supabaseAdmin
      .from("conversations")
      .select("*")
      .eq("id", racedCall.conversation_id)
      .single();
    if (canonicalError || !canonicalConversation) {
      throw new Error("No se pudo recuperar la conversación canónica de la llamada");
    }
    return {
      conversation: canonicalConversation as ConversationRow,
      callSession: racedCall,
      caller,
      called,
    };
  }
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

  const [{ data: clinic }, { data: services }, { data: client }] = await Promise.all([
    supabaseAdmin.from("clinics").select("name, timezone").eq("id", channel.clinic_id).single(),
    supabaseAdmin
      .from("services")
      .select(
        "name, duration_minutes, price_min_cents, price_max_cents, is_surgery, requires_fasting",
      )
      .eq("clinic_id", channel.clinic_id)
      .eq("active", true)
      .order("name"),
    caller
      ? supabaseAdmin
          .from("clients")
          .select("id, name, phone")
          .eq("clinic_id", channel.clinic_id)
          .eq("phone", caller)
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

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
  const timezone = clinic?.timezone ?? "Europe/Madrid";
  const now = new Date();
  const currentLocalDate = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  const [year, month, day] = currentLocalDate.split("-").map(Number);
  const tomorrowUtc = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + 1));
  const tomorrowLocalDate = [
    tomorrowUtc.getUTCFullYear(),
    String(tomorrowUtc.getUTCMonth() + 1).padStart(2, "0"),
    String(tomorrowUtc.getUTCDate()).padStart(2, "0"),
  ].join("-");
  const tomorrowMorningFrom = formatInTimeZone(
    fromZonedTime(`${tomorrowLocalDate}T00:00:00`, timezone),
    timezone,
    "yyyy-MM-dd'T'HH:mm:ssXXX",
  );
  const tomorrowMorningTo = formatInTimeZone(
    fromZonedTime(`${tomorrowLocalDate}T13:59:59`, timezone),
    timezone,
    "yyyy-MM-dd'T'HH:mm:ssXXX",
  );

  return {
    assistantId,
    assistantOverrides: {
      variableValues: {
        currentLocalDate,
        currentLocalTime: formatInTimeZone(now, timezone, "HH:mm:ss"),
        currentLocalIso: formatInTimeZone(now, timezone, "yyyy-MM-dd'T'HH:mm:ssXXX"),
        tomorrowLocalDate,
        tomorrowMorningFrom,
        tomorrowMorningTo,
        timezone,
        clinicName: clinic?.name ?? "el hospital veterinario",
        customerPhone: caller || "no disponible",
        customerName: client?.name ?? "cliente no identificado",
        customerContext: JSON.stringify({ pets: pets ?? [], appointments: appointments ?? [] }),
        serviceCatalog: JSON.stringify(
          (services ?? []).map((service) => ({
            name: service.name,
            duration_minutes: service.duration_minutes,
            price_min_euros:
              service.price_min_cents === null ? null : service.price_min_cents / 100,
            price_max_euros:
              service.price_max_cents === null ? null : service.price_max_cents / 100,
            is_surgery: service.is_surgery,
            requires_fasting: service.requires_fasting,
          })),
        ),
        humanTransferNumber:
          typeof config.transfer_number === "string" ? config.transfer_number : "",
      },
    },
  };
}
