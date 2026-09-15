export type ConversationControlState = "ai" | "attention" | "human" | "closed";

export type EscalationDetails = {
  reason: string;
  urgency: string;
  summary: string;
  escalatedAt: string | null;
};

const ESCALATION_REASON_LABELS: Record<string, string> = {
  urgent_medical: "Urgencia clínica",
  complaint: "Queja",
  medication_query: "Consulta de medicación",
  surgery_pricing: "Presupuesto de cirugía",
  grief: "Duelo",
  client_request: "Solicita una persona",
  ambiguity_unresolved: "No se pudo resolver",
  other: "Atención del equipo",
};

export function conversationControlState(status: string): ConversationControlState {
  if (status === "active") return "ai";
  if (status === "awaiting_human") return "attention";
  if (status === "human_handling") return "human";
  return "closed";
}

export function escalationReasonLabel(reason: string): string {
  return ESCALATION_REASON_LABELS[reason] ?? "Atención del equipo";
}

export function readEscalationDetails(metadata: unknown): EscalationDetails | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const escalation = (metadata as Record<string, unknown>).escalation;
  if (!escalation || typeof escalation !== "object" || Array.isArray(escalation)) return null;
  const record = escalation as Record<string, unknown>;

  return {
    reason: typeof record.reason === "string" ? record.reason : "other",
    urgency: typeof record.urgency === "string" ? record.urgency : "low",
    summary: typeof record.summary === "string" ? record.summary : "Requiere revisión del equipo.",
    escalatedAt: typeof record.escalated_at === "string" ? record.escalated_at : null,
  };
}

export function isTechnicalConversationMessage(message: {
  sender: string;
  content: string | null;
  contentType?: string | null;
}): boolean {
  return (
    message.sender === "system" &&
    (message.contentType === "tool_call" ||
      message.contentType === "tool_result" ||
      /^\[tool_(?:use|result):/i.test(message.content ?? ""))
  );
}
