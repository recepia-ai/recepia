import { processInboundMessage } from "@/lib/channels/process-inbound-message";
import {
  applyWhatsAppCloudStatuses,
  inboundEventsFromWhatsAppCloud,
  parseWhatsAppCloudWebhook,
  resolveWhatsAppCloudChannel,
} from "@/lib/channels/whatsapp-cloud";
import { sendWhatsAppText } from "@/lib/channels/whatsapp-provider";
import { createAdminClient } from "@/lib/supabase/admin";

export type WhatsAppCloudProvider = "360dialog" | "meta_cloud";

export async function processWhatsAppCloudWebhook(
  provider: WhatsAppCloudProvider,
  payload: unknown,
): Promise<void> {
  const webhook = parseWhatsAppCloudWebhook(payload);
  const supabaseAdmin = createAdminClient();
  await applyWhatsAppCloudStatuses(supabaseAdmin, webhook, provider);

  for (const entry of webhook.entry) {
    for (const change of entry.changes) {
      if (!change.value.messages?.length) continue;
      const channel = await resolveWhatsAppCloudChannel(
        supabaseAdmin,
        provider,
        change.value.metadata.phone_number_id,
        change.value.metadata.display_phone_number,
      );
      const scopedWebhook = parseWhatsAppCloudWebhook({
        object: webhook.object,
        entry: [{ changes: [change] }],
      });

      for (const event of inboundEventsFromWhatsAppCloud(scopedWebhook, channel, provider)) {
        const result = await processInboundMessage(supabaseAdmin, event);
        if (!result.response || result.duplicate || result.queuedForHuman) continue;

        try {
          const sent = await sendWhatsAppText(
            supabaseAdmin,
            channel,
            event.externalThreadId,
            result.response,
          );
          const { data: outbound } = await supabaseAdmin
            .from("messages")
            .select("id, metadata")
            .eq("conversation_id", result.conversationId ?? "")
            .eq("direction", "outbound")
            .eq("sender", "agent")
            .is("provider_message_id", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (outbound) {
            await supabaseAdmin
              .from("messages")
              .update({
                provider_message_id: `${provider}:${sent.externalMessageId}`,
                metadata: { delivery_status: "accepted", accepted_at: sent.acceptedAt },
              })
              .eq("id", outbound.id);
          }
        } catch (error) {
          console.error(`[${provider}] outbound delivery failed`, error);
          if (result.conversationId) {
            await supabaseAdmin
              .from("conversations")
              .update({ status: "awaiting_human" })
              .eq("id", result.conversationId);
          }
        }
      }
    }
  }
}
