import type { InboundChannelEvent, SendResult } from "@recepia/core";
import type { Database } from "@recepia/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

type AdminClient = SupabaseClient<Database>;
type ChannelRow = Database["public"]["Tables"]["clinic_channels"]["Row"];

const messageSchema = z.object({
  from: z.string().min(1),
  id: z.string().min(1),
  timestamp: z.string().min(1),
  type: z.string().min(1),
  text: z.object({ body: z.string().min(1) }).optional(),
  audio: z.object({ id: z.string().min(1), mime_type: z.string().min(1) }).optional(),
  image: z
    .object({ id: z.string().min(1), mime_type: z.string().min(1), caption: z.string().optional() })
    .optional(),
  document: z
    .object({
      id: z.string().min(1),
      mime_type: z.string().min(1),
      filename: z.string().optional(),
      caption: z.string().optional(),
    })
    .optional(),
});

const statusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["sent", "delivered", "read", "failed"]),
  timestamp: z.string().optional(),
});

const webhookSchema = z.object({
  object: z.string().optional(),
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          value: z.object({
            metadata: z.object({
              display_phone_number: z.string().min(1),
              phone_number_id: z.string().min(1),
            }),
            contacts: z
              .array(
                z.object({
                  wa_id: z.string().min(1),
                  profile: z.object({ name: z.string().optional() }).optional(),
                }),
              )
              .optional(),
            messages: z.array(messageSchema).optional(),
            statuses: z.array(statusSchema).optional(),
          }),
        }),
      ),
    }),
  ),
});

export type WhatsAppWebhook = z.infer<typeof webhookSchema>;

function configObject(value: ChannelRow["provider_config"]): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

export function parse360DialogWebhook(payload: unknown): WhatsAppWebhook {
  return webhookSchema.parse(payload);
}

export async function resolve360DialogChannel(
  supabaseAdmin: AdminClient,
  phoneNumberId: string,
  displayPhoneNumber: string,
): Promise<ChannelRow> {
  const { data, error } = await supabaseAdmin
    .from("clinic_channels")
    .select("*")
    .eq("channel_type", "whatsapp")
    .eq("provider", "360dialog")
    .eq("status", "active");

  if (error) throw new Error(`No se pudo resolver el canal de WhatsApp: ${error.message}`);

  const display = normalizePhone(displayPhoneNumber);
  const channel = (data ?? []).find((candidate) => {
    const config = configObject(candidate.provider_config);
    return (
      config.phone_number_id === phoneNumberId || normalizePhone(candidate.identifier) === display
    );
  });

  if (!channel) throw new Error(`No hay un canal 360dialog activo para ${displayPhoneNumber}`);
  return channel;
}

export async function resolveClinic360DialogChannel(
  supabaseAdmin: AdminClient,
  clinicId: string,
): Promise<ChannelRow> {
  const { data, error } = await supabaseAdmin
    .from("clinic_channels")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("channel_type", "whatsapp")
    .eq("provider", "360dialog")
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) throw new Error("No hay un canal 360dialog activo para esta clínica");
  return data;
}

export function inboundEventsFrom360Dialog(
  webhook: WhatsAppWebhook,
  channel: ChannelRow,
): InboundChannelEvent[] {
  const events: InboundChannelEvent[] = [];

  for (const entry of webhook.entry) {
    for (const change of entry.changes) {
      const contactById = new Map(
        (change.value.contacts ?? []).map((contact) => [contact.wa_id, contact]),
      );

      for (const message of change.value.messages ?? []) {
        const contact = contactById.get(message.from);
        const base = {
          type: "message.received" as const,
          clinicId: channel.clinic_id,
          channel: "whatsapp" as const,
          provider: "360dialog",
          eventId: message.id,
          externalThreadId: message.from,
          externalMessageId: message.id,
          occurredAt: new Date(Number(message.timestamp) * 1000).toISOString(),
          contact: {
            externalId: message.from,
            phone: `+${normalizePhone(message.from)}`,
            displayName: contact?.profile?.name,
          },
        };

        if (message.type === "text" && message.text) {
          events.push({ ...base, content: { kind: "text", text: message.text.body } });
        } else if (message.type === "audio" && message.audio) {
          events.push({
            ...base,
            content: {
              kind: "audio",
              mediaId: message.audio.id,
              mimeType: message.audio.mime_type,
            },
          });
        } else {
          const attachment = message.image ?? message.document;
          if (attachment) {
            events.push({
              ...base,
              content: {
                kind: "attachment",
                mediaId: attachment.id,
                mimeType: attachment.mime_type,
                filename: message.document?.filename,
                caption: attachment.caption,
              },
            });
          }
        }
      }
    }
  }

  return events;
}

async function readApiKey(supabaseAdmin: AdminClient, channel: ChannelRow): Promise<string> {
  if (!channel.vault_secret_id) throw new Error("El canal de WhatsApp no tiene credenciales");
  const { data, error } = await supabaseAdmin.rpc("vault_read_secret", {
    p_id: channel.vault_secret_id,
  });
  if (error || !data) throw new Error("No se pudo leer la credencial de 360dialog");

  try {
    const parsed = JSON.parse(data as string) as { api_key?: string };
    if (parsed.api_key) return parsed.api_key;
  } catch {
    // A raw API key is also accepted for backwards compatibility.
  }
  return data as string;
}

export async function send360DialogText(
  supabaseAdmin: AdminClient,
  channel: ChannelRow,
  recipient: string,
  text: string,
): Promise<SendResult> {
  const apiKey = await readApiKey(supabaseAdmin, channel);
  for (let attempt = 1; attempt <= 3; attempt++) {
    let response: Response;
    try {
      response = await fetch("https://waba-v2.360dialog.io/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "D360-API-KEY": apiKey },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: normalizePhone(recipient),
          type: "text",
          text: { body: text },
        }),
      });
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      continue;
    }

    const body = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
    };
    const externalMessageId = body.messages?.[0]?.id;
    if (response.ok && externalMessageId) {
      return { externalMessageId, acceptedAt: new Date().toISOString() };
    }
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 3) {
      throw new Error(`360dialog rechazó el mensaje (${response.status})`);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }
  throw new Error("360dialog no aceptó el mensaje después de tres intentos");
}

export async function apply360DialogStatuses(
  supabaseAdmin: AdminClient,
  webhook: WhatsAppWebhook,
): Promise<void> {
  for (const entry of webhook.entry) {
    for (const change of entry.changes) {
      for (const status of change.value.statuses ?? []) {
        const { data: message } = await supabaseAdmin
          .from("messages")
          .select("id, metadata")
          .eq("provider_message_id", `360dialog:${status.id}`)
          .maybeSingle();
        if (!message) continue;
        const metadata = configObject(message.metadata);
        await supabaseAdmin
          .from("messages")
          .update({
            metadata: {
              ...metadata,
              delivery_status: status.status,
              delivery_updated_at: status.timestamp
                ? new Date(Number(status.timestamp) * 1000).toISOString()
                : new Date().toISOString(),
            },
          })
          .eq("id", message.id);
      }
    }
  }
}
