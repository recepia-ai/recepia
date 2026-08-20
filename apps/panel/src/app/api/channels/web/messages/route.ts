import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const querySchema = z.object({
  clinicSlug: z.string().trim().min(1).max(80),
  sessionId: z.string().uuid(),
  phone: z.string().regex(/^\+[1-9][0-9]{6,14}$/),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return Response.json({ error: "Consulta inválida" }, { status: 400 });

  const supabaseAdmin = createAdminClient();
  const { data: clinic } = await supabaseAdmin
    .from("clinics")
    .select("id")
    .eq("slug", parsed.data.clinicSlug)
    .eq("status", "active")
    .maybeSingle();
  if (!clinic) return Response.json({ error: "Clínica no disponible" }, { status: 404 });

  const { data: conversation } = await supabaseAdmin
    .from("conversations")
    .select("id, metadata")
    .eq("clinic_id", clinic.id)
    .eq("channel", "web")
    .eq("channel_thread_id", parsed.data.sessionId)
    .is("deleted_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!conversation) return Response.json({ messages: [] });

  const metadata =
    conversation.metadata && typeof conversation.metadata === "object"
      ? (conversation.metadata as Record<string, unknown>)
      : {};
  if (metadata.client_phone !== parsed.data.phone) {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data: messages, error } = await supabaseAdmin
    .from("messages")
    .select("id, sender, content, created_at")
    .eq("conversation_id", conversation.id)
    .eq("direction", "outbound")
    .in("sender", ["agent", "human", "system"])
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) return Response.json({ error: "No se pudieron leer los mensajes" }, { status: 500 });

  return Response.json({ messages: messages ?? [] });
}
