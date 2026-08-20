import { createHmac, timingSafeEqual } from "node:crypto";
import type { SendResult } from "@recepia/core";
import {
  type AdminClient,
  applyWhatsAppCloudStatuses,
  type ChannelRow,
  configObject,
  inboundEventsFromWhatsAppCloud,
  normalizePhone,
  parseWhatsAppCloudWebhook,
  readWhatsAppCredential,
  resolveClinicWhatsAppCloudChannel,
  resolveWhatsAppCloudChannel,
  type WhatsAppCloudWebhook,
} from "@/lib/channels/whatsapp-cloud";

export type MetaWhatsAppWebhook = WhatsAppCloudWebhook;

export const parseMetaWhatsAppWebhook = parseWhatsAppCloudWebhook;

export function resolveMetaWhatsAppChannel(
  supabaseAdmin: AdminClient,
  phoneNumberId: string,
  displayPhoneNumber: string,
): Promise<ChannelRow> {
  return resolveWhatsAppCloudChannel(
    supabaseAdmin,
    "meta_cloud",
    phoneNumberId,
    displayPhoneNumber,
  );
}

export function resolveClinicMetaWhatsAppChannel(
  supabaseAdmin: AdminClient,
  clinicId: string,
): Promise<ChannelRow> {
  return resolveClinicWhatsAppCloudChannel(supabaseAdmin, clinicId, "meta_cloud");
}

export function inboundEventsFromMetaWhatsApp(webhook: MetaWhatsAppWebhook, channel: ChannelRow) {
  return inboundEventsFromWhatsAppCloud(webhook, channel, "meta_cloud");
}

function graphApiVersion(channel: ChannelRow): string {
  const version = configObject(channel.provider_config).graph_api_version;
  if (typeof version !== "string" || !/^v\d+\.\d+$/.test(version)) {
    throw new Error("El canal de Meta no tiene una versión válida de Graph API");
  }
  return version;
}

function phoneNumberId(channel: ChannelRow): string {
  const value = configObject(channel.provider_config).phone_number_id;
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("El canal de Meta no tiene Phone Number ID");
  }
  return value;
}

export async function sendMetaWhatsAppText(
  supabaseAdmin: AdminClient,
  channel: ChannelRow,
  recipient: string,
  text: string,
): Promise<SendResult> {
  const accessToken = await readWhatsAppCredential(supabaseAdmin, channel);
  const endpoint = `https://graph.facebook.com/${graphApiVersion(channel)}/${phoneNumberId(channel)}/messages`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
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
      error?: { message?: string };
    };
    const externalMessageId = body.messages?.[0]?.id;
    if (response.ok && externalMessageId) {
      return { externalMessageId, acceptedAt: new Date().toISOString() };
    }

    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 3) {
      const detail = body.error?.message ? `: ${body.error.message}` : "";
      throw new Error(`Meta rechazó el mensaje (${response.status})${detail}`);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }
  throw new Error("Meta no aceptó el mensaje después de tres intentos");
}

export function applyMetaWhatsAppStatuses(
  supabaseAdmin: AdminClient,
  webhook: MetaWhatsAppWebhook,
): Promise<void> {
  return applyWhatsAppCloudStatuses(supabaseAdmin, webhook, "meta_cloud");
}

export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const suppliedHex = signatureHeader.slice("sha256=".length);
  if (!/^[a-f\d]{64}$/i.test(suppliedHex)) return false;

  const expected = Buffer.from(createHmac("sha256", appSecret).update(rawBody).digest("hex"));
  const supplied = Buffer.from(suppliedHex.toLowerCase());
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
