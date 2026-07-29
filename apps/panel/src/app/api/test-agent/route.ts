import { createAdminClient } from "@/lib/supabase/admin";
import { startConversation, loadMessages } from "@/lib/agent/conversation-store";
import { runAgentLoop } from "@/lib/agent/loop";

const CLINIC_ID = "00000000-0000-0000-0000-000000000001";

export async function POST(request: Request) {
  try {
    const { phone, message, conversationId } = await request.json();
    if (!message) {
      return Response.json({ error: "message is required" }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    let convId = conversationId;
    if (!convId) {
      const conv = await startConversation(supabaseAdmin, CLINIC_ID, "web", phone ?? undefined);
      convId = conv.id;
    }

    const previousMessages = await loadMessages(supabaseAdmin, convId);
    const result = await runAgentLoop({
      conversationId: convId,
      clinicId: CLINIC_ID,
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
