import { loadMessages, startConversation } from "@/lib/agent/conversation-store";
import { runAgentLoop } from "@/lib/agent/loop";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLegacyTestAgentApiEnabled } from "@/lib/test-routes";

export async function POST(request: Request) {
  if (!isLegacyTestAgentApiEnabled()) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { phone, message, conversationId, clinicSlug } = await request.json();
    if (!message) {
      return Response.json({ error: "message is required" }, { status: 400 });
    }
    if (!clinicSlug) {
      return Response.json({ error: "clinicSlug is required" }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from("clinics")
      .select("id")
      .eq("slug", clinicSlug)
      .eq("status", "active")
      .single();
    if (clinicError || !clinic) {
      return Response.json({ error: "clinic not found" }, { status: 404 });
    }
    const clinicId = clinic.id;
    let convId = conversationId;
    if (!convId) {
      const conv = await startConversation(supabaseAdmin, clinicId, "web", phone ?? undefined);
      convId = conv.id;
    }

    const previousMessages = await loadMessages(supabaseAdmin, convId);
    const result = await runAgentLoop({
      conversationId: convId,
      clinicId,
      userMessage: message,
      previousMessages,
      clientPhone: phone,
      supabaseAdmin,
    });

    return Response.json({
      conversationId: convId,
      response: result.response,
      toolCalls: result.toolCalls,
      terminated: result.terminated,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error desconocido";
    console.error("[api/test-agent] error:", errorMessage);
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
