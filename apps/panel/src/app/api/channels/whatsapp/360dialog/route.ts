import { after } from "next/server";
import { processWhatsAppCloudWebhook } from "@/lib/channels/process-whatsapp-cloud-webhook";
import { secureEqual } from "@/lib/channels/webhook-security";
import { parseWhatsAppCloudWebhook } from "@/lib/channels/whatsapp-cloud";

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
      return parseWhatsAppCloudWebhook(payload);
    } catch {
      return null;
    }
  })();
  if (!parsed) return Response.json({ error: "Payload inválido" }, { status: 400 });

  after(async () => {
    try {
      await processWhatsAppCloudWebhook("360dialog", parsed);
    } catch (error) {
      console.error("[360dialog] webhook processing failed", error);
    }
  });

  return Response.json({ received: true });
}
