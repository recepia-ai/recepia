import { after } from "next/server";
import { processEvolutionWebhook } from "@/lib/channels/process-evolution-webhook";
import { secureEqual } from "@/lib/channels/webhook-security";
import { parseEvolutionWebhook } from "@/lib/channels/whatsapp-evolution";

export async function POST(request: Request) {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[evolution] EVOLUTION_WEBHOOK_SECRET is not configured");
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
      return parseEvolutionWebhook(payload);
    } catch {
      return null;
    }
  })();
  if (!parsed) return Response.json({ error: "Payload inválido" }, { status: 400 });

  after(async () => {
    try {
      await processEvolutionWebhook(parsed);
    } catch (error) {
      console.error("[evolution] webhook processing failed", error);
    }
  });

  return Response.json({ received: true });
}
