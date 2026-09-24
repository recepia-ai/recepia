import type { Database } from "@recepia/db";
import { processInboundMessage } from "@/lib/channels/process-inbound-message";
import { configObject } from "@/lib/channels/whatsapp-cloud";
import { failedWhatsAppDeliveryMetadata } from "@/lib/channels/whatsapp-delivery";
import {
  type EvolutionWebhook,
  inboundEventFromEvolution,
  resolveEvolutionChannel,
} from "@/lib/channels/whatsapp-evolution";
import { sendWhatsAppText } from "@/lib/channels/whatsapp-provider";
import { shouldSendAutomatedWhatsAppReply } from "@/lib/channels/whatsapp-reply-policy";
import { recordOperationalSignal } from "@/lib/operational-alert-transport";
import {
  createOperationalLogRecord,
  operationalErrorCode,
  operationalLog,
} from "@/lib/operational-logger";
import { createAdminClient } from "@/lib/supabase/admin";

export async function processEvolutionWebhook(payload: EvolutionWebhook): Promise<void> {
  const supabaseAdmin = createAdminClient();
  const channel = await resolveEvolutionChannel(supabaseAdmin, payload.instance);
  const event = inboundEventFromEvolution(payload, channel);
  if (!event) return;

  const result = await processInboundMessage(supabaseAdmin, event);
  if (!shouldSendAutomatedWhatsAppReply(result) || !result.response) return;

  const { data: outbound } = await supabaseAdmin
    .from("messages")
    .select("id, metadata")
    .eq("clinic_id", channel.clinic_id)
    .eq("conversation_id", result.conversationId ?? "")
    .eq("direction", "outbound")
    .eq("sender", "agent")
    .is("provider_message_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  try {
    const sent = await sendWhatsAppText(
      supabaseAdmin,
      channel,
      event.externalThreadId,
      result.response,
    );
    if (outbound) {
      await supabaseAdmin
        .from("messages")
        .update({
          provider_message_id: `evolution:${sent.externalMessageId}`,
          metadata: {
            ...configObject(outbound.metadata),
            delivery_status: "accepted",
            accepted_at: sent.acceptedAt,
          },
        })
        .eq("clinic_id", channel.clinic_id)
        .eq("id", outbound.id);
    }
  } catch (error) {
    const logContext = {
      clinic_id: channel.clinic_id,
      conversation_id: result.conversationId ?? undefined,
      channel: "whatsapp",
      provider: "evolution",
      error_code: operationalErrorCode(error, "WHATSAPP_OUTBOUND_FAILED"),
    };
    operationalLog("error", "whatsapp.outbound.failed", logContext);
    await recordOperationalSignal(
      supabaseAdmin,
      createOperationalLogRecord("error", "whatsapp.outbound.failed", logContext),
    );
    if (outbound) {
      await supabaseAdmin
        .from("messages")
        .update({
          metadata: failedWhatsAppDeliveryMetadata(
            configObject(outbound.metadata),
          ) as Database["public"]["Tables"]["messages"]["Update"]["metadata"],
        })
        .eq("clinic_id", channel.clinic_id)
        .eq("id", outbound.id);
    }
    if (result.conversationId) {
      await supabaseAdmin
        .from("conversations")
        .update({ status: "awaiting_human" })
        .eq("id", result.conversationId);
    }
  }
}
