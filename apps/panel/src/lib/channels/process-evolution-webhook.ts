import { processInboundMessage } from "@/lib/channels/process-inbound-message";
import {
  type EvolutionWebhook,
  inboundEventFromEvolution,
  resolveEvolutionChannel,
} from "@/lib/channels/whatsapp-evolution";
import { sendWhatsAppText } from "@/lib/channels/whatsapp-provider";
import { createAdminClient } from "@/lib/supabase/admin";

export async function processEvolutionWebhook(payload: EvolutionWebhook): Promise<void> {
  const supabaseAdmin = createAdminClient();
  const channel = await resolveEvolutionChannel(supabaseAdmin, payload.instance);
  const event = inboundEventFromEvolution(payload, channel);
  if (!event) return;

  const result = await processInboundMessage(supabaseAdmin, event);
  if (!result.response || result.duplicate || result.queuedForHuman) return;

  try {
    const sent = await sendWhatsAppText(
      supabaseAdmin,
      channel,
      event.externalThreadId,
      result.response,
    );
    const { data: outbound } = await supabaseAdmin
      .from("messages")
      .select("id")
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
          provider_message_id: `evolution:${sent.externalMessageId}`,
          metadata: { delivery_status: "accepted", accepted_at: sent.acceptedAt },
        })
        .eq("id", outbound.id);
    }
  } catch (error) {
    console.error("[evolution] outbound delivery failed", error);
    if (result.conversationId) {
      await supabaseAdmin
        .from("conversations")
        .update({ status: "awaiting_human" })
        .eq("id", result.conversationId);
    }
  }
}
