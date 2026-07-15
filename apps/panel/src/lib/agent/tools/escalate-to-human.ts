import { z } from "zod";
import type { Tool, ToolResult, ToolContext } from "./types";

// ---------------------------------------------------------------------------
// escalate_to_human
//
// Escalation fields (reason, urgency, summary) are stored in the existing
// conversations.metadata JSONB column as metadata.escalation. No dedicated
// escalation columns exist yet — they may be added in E3.3.
// ---------------------------------------------------------------------------

const REASONS = [
  "urgent_medical",
  "complaint",
  "medication_query",
  "surgery_pricing",
  "grief",
  "client_request",
  "ambiguity_unresolved",
  "other",
] as const;

const URGENCIES = ["low", "medium", "high", "critical"] as const;

const inputSchema = z.object({
  reason: z.enum(REASONS),
  urgency: z.enum(URGENCIES),
  summary: z.string().trim().min(1, "El resumen es obligatorio").max(2000),
});

type Input = z.infer<typeof inputSchema>;

type Output = {
  escalated: boolean;
  urgency: string;
  reason: string;
};

async function handler(input: Input, ctx: ToolContext): Promise<ToolResult<Output>> {
  const escalationData = {
    reason: input.reason,
    urgency: input.urgency,
    summary: input.summary,
    escalated_at: new Date().toISOString(),
  };

  if (!ctx.conversationId) {
    // Test mode or no conversation — log and return success
    ctx.logger(
      "[escalate_to_human] no conversationId — escalation logged but not saved",
      escalationData,
    );
    return {
      success: true,
      data: { escalated: true, urgency: input.urgency, reason: input.reason },
    };
  }

  // Merge escalation data into conversations.metadata JSONB
  const { error } = await (ctx.supabaseAdmin
    .from("conversations") as any)
    .update({
      status: "awaiting_human",
    })
    .eq("id", ctx.conversationId)
    .eq("clinic_id", ctx.clinicId);

  if (error) {
    ctx.logger("[escalate_to_human] status update error", error);
    return { success: false, error: "Error al escalar la conversación." };
  }

  // Store escalation details in metadata (read-merge-write for jsonb)
  try {
    const { data: current } = await ctx.supabaseAdmin
      .from("conversations")
      .select("metadata")
      .eq("id", ctx.conversationId)
      .maybeSingle();

    if (current) {
      const existing = (current as { metadata: Record<string, unknown> }).metadata ?? {};
      const merged = {
        ...existing,
        escalation: escalationData,
      };

      await (ctx.supabaseAdmin.from("conversations") as any)
        .update({ metadata: merged })
        .eq("id", ctx.conversationId);
    }
  } catch (metaErr) {
    ctx.logger("[escalate_to_human] metadata merge error (non-fatal)", metaErr);
    // Non-fatal — status was already updated
  }

  return {
    success: true,
    data: { escalated: true, urgency: input.urgency, reason: input.reason },
  };
}

export const escalateToHuman: Tool<Input, Output> = {
  name: "escalate_to_human",
  description:
    "Escala la conversación a un humano del equipo. Usa esto SIEMPRE en: urgencias médicas, quejas, preguntas sobre medicación, precios de cirugías, casos de duelo, o cuando el cliente lo pide explícitamente.",
  inputSchema,
  handler,
};
