import { after } from "next/server";
import { processWhatsAppCloudWebhook } from "@/lib/channels/process-whatsapp-cloud-webhook";
import { secureEqual } from "@/lib/channels/webhook-security";
import { parseMetaWhatsAppWebhook, verifyMetaWebhookSignature } from "@/lib/channels/whatsapp-meta";

export async function GET(request: Request) {
  const verifyToken = process.env.META_WHATSAPP_VERIFY_TOKEN;
  if (!verifyToken) {
    console.error("[meta_cloud] META_WHATSAPP_VERIFY_TOKEN is not configured");
    return new Response("Webhook no configurado", { status: 503 });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const suppliedToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !challenge || !secureEqual(suppliedToken, verifyToken)) {
    return new Response("Verificación rechazada", { status: 403 });
  }
  return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

export async function POST(request: Request) {
  const appSecret = process.env.META_WHATSAPP_APP_SECRET;
  if (!appSecret) {
    console.error("[meta_cloud] META_WHATSAPP_APP_SECRET is not configured");
    return Response.json({ error: "Webhook no configurado" }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifyMetaWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    return Response.json({ error: "Firma inválida" }, { status: 401 });
  }

  const payload = (() => {
    try {
      return JSON.parse(rawBody) as unknown;
    } catch {
      return null;
    }
  })();
  const parsed = (() => {
    try {
      return parseMetaWhatsAppWebhook(payload);
    } catch {
      return null;
    }
  })();
  if (!parsed) return Response.json({ error: "Payload inválido" }, { status: 400 });

  after(async () => {
    try {
      await processWhatsAppCloudWebhook("meta_cloud", parsed);
    } catch (error) {
      console.error("[meta_cloud] webhook processing failed", error);
    }
  });

  return Response.json({ received: true });
}
