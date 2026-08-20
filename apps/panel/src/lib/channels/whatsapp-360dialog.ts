import type { SendResult } from "@recepia/core";
import {
  type AdminClient,
  applyWhatsAppCloudStatuses,
  type ChannelRow,
  inboundEventsFromWhatsAppCloud,
  normalizePhone,
  parseWhatsAppCloudWebhook,
  readWhatsAppCredential,
  resolveClinicWhatsAppCloudChannel,
  resolveWhatsAppCloudChannel,
  type WhatsAppCloudWebhook,
} from "@/lib/channels/whatsapp-cloud";

export type WhatsAppWebhook = WhatsAppCloudWebhook;

export const parse360DialogWebhook = parseWhatsAppCloudWebhook;

export function resolve360DialogChannel(
  supabaseAdmin: AdminClient,
  phoneNumberId: string,
  displayPhoneNumber: string,
): Promise<ChannelRow> {
  return resolveWhatsAppCloudChannel(supabaseAdmin, "360dialog", phoneNumberId, displayPhoneNumber);
}

export function resolveClinic360DialogChannel(
  supabaseAdmin: AdminClient,
  clinicId: string,
): Promise<ChannelRow> {
  return resolveClinicWhatsAppCloudChannel(supabaseAdmin, clinicId, "360dialog");
}

export function inboundEventsFrom360Dialog(webhook: WhatsAppWebhook, channel: ChannelRow) {
  return inboundEventsFromWhatsAppCloud(webhook, channel, "360dialog");
}

export async function send360DialogText(
  supabaseAdmin: AdminClient,
  channel: ChannelRow,
  recipient: string,
  text: string,
): Promise<SendResult> {
  const apiKey = await readWhatsAppCredential(supabaseAdmin, channel);
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

export function apply360DialogStatuses(
  supabaseAdmin: AdminClient,
  webhook: WhatsAppWebhook,
): Promise<void> {
  return applyWhatsAppCloudStatuses(supabaseAdmin, webhook, "360dialog");
}
