import { createHash } from "node:crypto";
import { inboundChannelEventSchema } from "@recepia/core";
import { z } from "zod";
import { processInboundMessage } from "@/lib/channels/process-inbound-message";
import { createAdminClient } from "@/lib/supabase/admin";

const requestSchema = z.object({
  clinicSlug: z.string().trim().min(1).max(80),
  sessionId: z.string().uuid(),
  messageId: z.string().uuid(),
  message: z.string().trim().min(1).max(4000),
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9][0-9]{6,14}$/)
    .optional(),
});

function configuredOrigins(config: unknown): string[] {
  if (!config || typeof config !== "object" || Array.isArray(config)) return [];
  const web = (config as Record<string, unknown>).web;
  if (!web || typeof web !== "object" || Array.isArray(web)) return [];
  const origins = (web as Record<string, unknown>).allowed_origins;
  return Array.isArray(origins)
    ? origins.filter((value): value is string => typeof value === "string")
    : [];
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Solicitud de chat inválida" }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const { data: clinic } = await supabaseAdmin
    .from("clinics")
    .select("id, name, status, clinic_config(config)")
    .eq("slug", parsed.data.clinicSlug)
    .maybeSingle();

  if (!clinic || clinic.status !== "active") {
    return Response.json({ error: "Clínica no disponible" }, { status: 404 });
  }

  const requestOrigin = request.headers.get("origin");
  const ownOrigin = new URL(request.url).origin;
  const configRelation = Array.isArray(clinic.clinic_config)
    ? clinic.clinic_config[0]
    : clinic.clinic_config;
  const envOrigins = (process.env.WEB_CHAT_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowedOrigins = new Set([
    ownOrigin,
    ...envOrigins,
    ...configuredOrigins(configRelation?.config),
  ]);

  if (requestOrigin && !allowedOrigins.has(requestOrigin)) {
    return Response.json({ error: "Origen no autorizado" }, { status: 403 });
  }

  const clientAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const addressHash = createHash("sha256")
    .update(`${clientAddress}:${parsed.data.sessionId}`)
    .digest("hex");
  const [{ data: sessionAllowed }, { data: clinicAllowed }] = await Promise.all([
    supabaseAdmin.rpc("consume_web_chat_rate_limit", {
      p_clinic_id: clinic.id,
      p_bucket_key: `session:${addressHash}`,
      p_limit: 20,
      p_window_seconds: 60,
    }),
    supabaseAdmin.rpc("consume_web_chat_rate_limit", {
      p_clinic_id: clinic.id,
      p_bucket_key: "clinic:global",
      p_limit: 200,
      p_window_seconds: 60,
    }),
  ]);
  if (!sessionAllowed || !clinicAllowed) {
    return Response.json(
      { error: "Hay demasiados mensajes. Espera un minuto antes de continuar." },
      { status: 429 },
    );
  }

  const now = new Date().toISOString();
  const event = inboundChannelEventSchema.parse({
    type: "message.received",
    clinicId: clinic.id,
    channel: "web",
    provider: "recepia-web",
    eventId: parsed.data.messageId,
    externalThreadId: parsed.data.sessionId,
    externalMessageId: parsed.data.messageId,
    occurredAt: now,
    contact: {
      externalId: parsed.data.sessionId,
      phone: parsed.data.phone,
    },
    content: { kind: "text", text: parsed.data.message },
  });

  try {
    const result = await processInboundMessage(supabaseAdmin, event);
    return Response.json(result);
  } catch (error) {
    console.error("[web-channel] processing failed", error);
    return Response.json(
      { error: "No hemos podido procesar el mensaje. El equipo lo revisará." },
      { status: 500 },
    );
  }
}
