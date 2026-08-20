import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { processInboundMessage } from "@/lib/channels/process-inbound-message";
import {
  apply360DialogStatuses,
  inboundEventsFrom360Dialog,
  parse360DialogWebhook,
  resolve360DialogChannel,
  send360DialogText,
} from "@/lib/channels/whatsapp-360dialog";
import { createAdminClient } from "@/lib/supabase/admin";

function secureEqual(actual: string | null, expected: string): boolean {
  if (!actual) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

async function processWebhook(payload: unknown): Promise<void> {
  const webhook = parse360DialogWebhook(payload);
  const supabaseAdmin = createAdminClient();
  await apply360DialogStatuses(supabaseAdmin, webhook);

  for (const entry of webhook.entry) {
    for (const change of entry.changes) {
      if (!change.value.messages?.length) continue;
      const channel = await resolve360DialogChannel(
        supabaseAdmin,
        change.value.metadata.phone_number_id,
        change.value.metadata.display_phone_number,
      );
      const scopedWebhook = parse360DialogWebhook({
        object: webhook.object,
        entry: [{ changes: [change] }],
      });

      for (const event of inboundEventsFrom360Dialog(scopedWebhook, channel)) {
        const result = await processInboundMessage(supabaseAdmin, event);
        if (!result.response || result.duplicate || result.queuedForHuman) continue;

        try {
          const sent = await send360DialogText(
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
                provider_message_id: `360dialog:${sent.externalMessageId}`,
                metadata: { delivery_status: "accepted", accepted_at: sent.acceptedAt },
              })
              .eq("id", outbound.id);
          }
        } catch (error) {
          console.error("[360dialog] outbound delivery failed", error);
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

export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[360dialog] WHATSAPP_WEBHOOK_SECRET is not configured");
    return Response.json({ error: "Webhook no configurado" }, { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  const customSecret = request.headers.get("x-recepia-webhook-secret");
  if (!secureEqual(authorization, `Bearer ${secret}`) && !secureEqual(customSecret, secret)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = (() => {
    try {
      return parse360DialogWebhook(payload);
    } catch {
      return null;
    }
  })();
  if (!parsed) return Response.json({ error: "Payload inválido" }, { status: 400 });

  after(async () => {
    try {
      await processWebhook(payload);
    } catch (error) {
      console.error("[360dialog] webhook processing failed", error);
    }
  });

  return Response.json({ received: true });
}
