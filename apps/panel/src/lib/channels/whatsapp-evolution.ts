import type { InboundChannelEvent, SendResult } from "@recepia/core";
import { z } from "zod";
import {
  type AdminClient,
  type ChannelRow,
  configObject,
  normalizePhone,
  readWhatsAppCredential,
} from "@/lib/channels/whatsapp-cloud";

const evolutionPayloadSchema = z.object({
  event: z.string().min(1),
  instance: z.string().min(1),
  data: z.object({
    key: z.object({
      remoteJid: z.string().min(1),
      remoteJidAlt: z.string().optional(),
      fromMe: z.boolean().optional(),
      id: z.string().min(1),
    }),
    pushName: z.string().optional(),
    message: z.record(z.string(), z.unknown()).optional(),
    messageType: z.string().optional(),
    messageTimestamp: z.union([z.string(), z.number()]).optional(),
  }),
  date_time: z.string().optional(),
});

export type EvolutionWebhook = z.infer<typeof evolutionPayloadSchema>;
type EvolutionInboundContent = Extract<
  InboundChannelEvent,
  { type: "message.received" }
>["content"];

function nestedObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nestedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function eventName(value: string): string {
  return value.trim().toLowerCase().replaceAll("_", ".");
}

function occurredAt(payload: EvolutionWebhook): string {
  const timestamp = payload.data.messageTimestamp;
  if (timestamp !== undefined) {
    const numeric = Number(timestamp);
    if (Number.isFinite(numeric)) {
      const milliseconds = numeric > 10_000_000_000 ? numeric : numeric * 1000;
      const date = new Date(milliseconds);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }
  if (payload.date_time) {
    const date = new Date(payload.date_time);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

function contactJid(payload: EvolutionWebhook): string | null {
  const candidates = [payload.data.key.remoteJidAlt, payload.data.key.remoteJid];
  return candidates.find((value) => value?.endsWith("@s.whatsapp.net")) ?? null;
}

function inboundContent(payload: EvolutionWebhook): EvolutionInboundContent | null {
  const message = payload.data.message;
  if (!message) return null;

  const conversation = nestedString(message.conversation);
  if (conversation) return { kind: "text", text: conversation };

  const extended = nestedObject(message.extendedTextMessage);
  const extendedText = nestedString(extended?.text);
  if (extendedText) return { kind: "text", text: extendedText };

  const image = nestedObject(message.imageMessage);
  if (image) {
    return {
      kind: "attachment",
      mediaId: payload.data.key.id,
      mimeType: nestedString(image.mimetype) ?? "image/jpeg",
      caption: nestedString(image.caption),
    };
  }

  const document = nestedObject(message.documentMessage);
  if (document) {
    return {
      kind: "attachment",
      mediaId: payload.data.key.id,
      mimeType: nestedString(document.mimetype) ?? "application/octet-stream",
      filename: nestedString(document.fileName),
      caption: nestedString(document.caption),
    };
  }

  const audio = nestedObject(message.audioMessage);
  if (audio) {
    return {
      kind: "audio",
      mediaId: payload.data.key.id,
      mimeType: nestedString(audio.mimetype) ?? "audio/ogg",
    };
  }

  return null;
}

export function parseEvolutionWebhook(payload: unknown): EvolutionWebhook {
  return evolutionPayloadSchema.parse(payload);
}

export async function resolveEvolutionChannel(
  supabaseAdmin: AdminClient,
  instanceName: string,
): Promise<ChannelRow> {
  const { data, error } = await supabaseAdmin
    .from("clinic_channels")
    .select("*")
    .eq("channel_type", "whatsapp")
    .eq("provider", "evolution")
    .eq("status", "active");

  if (error) throw new Error(`No se pudo resolver el canal Evolution: ${error.message}`);
  const channel = (data ?? []).find(
    (candidate) => configObject(candidate.provider_config).instance_name === instanceName,
  );
  if (!channel) throw new Error(`No hay un canal Evolution activo para ${instanceName}`);
  return channel;
}

export function inboundEventFromEvolution(
  payload: EvolutionWebhook,
  channel: ChannelRow,
): InboundChannelEvent | null {
  if (eventName(payload.event) !== "messages.upsert" || payload.data.key.fromMe) return null;
  const jid = contactJid(payload);
  const content = inboundContent(payload);
  if (!jid || !content) return null;
  const phone = normalizePhone(jid.split("@")[0] ?? "");
  if (!phone) return null;

  return {
    type: "message.received",
    clinicId: channel.clinic_id,
    channel: "whatsapp",
    provider: "evolution",
    eventId: payload.data.key.id,
    externalThreadId: phone,
    externalMessageId: payload.data.key.id,
    occurredAt: occurredAt(payload),
    contact: {
      externalId: phone,
      phone: `+${phone}`,
      displayName: payload.data.pushName?.trim() || undefined,
    },
    content,
  };
}

export async function sendEvolutionText(
  supabaseAdmin: AdminClient,
  channel: ChannelRow,
  recipient: string,
  text: string,
): Promise<SendResult> {
  const config = configObject(channel.provider_config);
  const baseUrl = nestedString(config.base_url)?.replace(/\/$/, "");
  const instanceName = nestedString(config.instance_name);
  if (!baseUrl || !instanceName) {
    throw new Error("El canal Evolution no tiene base URL o nombre de instancia");
  }
  const apiKey = await readWhatsAppCredential(supabaseAdmin, channel);
  const endpoint = `${baseUrl}/message/sendText/${encodeURIComponent(instanceName)}`;
  const request = (body: Record<string, unknown>) =>
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
  const number = normalizePhone(recipient);
  let response = await request({ number, text });
  let body = (await response.json().catch(() => null)) as {
    key?: { id?: string };
    message?: unknown;
    response?: { message?: unknown };
  } | null;
  const rejection = JSON.stringify(body?.response?.message ?? body?.message ?? "");
  if (!response.ok && rejection.includes("textMessage")) {
    response = await request({ number, textMessage: { text } });
    body = (await response.json().catch(() => null)) as typeof body;
  }
  if (!response.ok) {
    const message = body?.response?.message ?? body?.message;
    throw new Error(
      typeof message === "string" ? message : `Evolution rechazó el mensaje (${response.status})`,
    );
  }
  const externalMessageId = body?.key?.id;
  if (!externalMessageId) throw new Error("Evolution no devolvió el ID del mensaje");
  return { externalMessageId, acceptedAt: new Date().toISOString() };
}
