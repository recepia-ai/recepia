type Channel = "web" | "whatsapp" | "phone";

export type PilotConversation = {
  id: string;
  clinic_id: string;
  channel: Channel;
  status: string;
  started_at: string;
  ended_at: string | null;
  controlled_at: string | null;
  metadata: unknown;
};

export type PilotCallSession = {
  id: string;
  clinic_id: string;
  conversation_id: string;
  duration_seconds: number | null;
  started_at: string;
  status: string;
};

export type PilotToolInvocation = {
  id: string;
  clinic_id: string;
  conversation_id: string | null;
  tool_name: string;
  success: boolean;
  error_code: string | null;
  duration_ms: number | null;
  created_at: string;
};

export type PilotAppointment = {
  id: string;
  clinic_id: string;
  conversation_id: string | null;
  created_by: string;
  created_at: string;
};

export type PilotMessage = {
  id: string;
  clinic_id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  sender: "client" | "agent" | "human" | "system";
  created_at: string;
};

export type PilotEvent = {
  id: string;
  clinic_id: string;
  conversation_id: string | null;
  event_type: string;
  created_at: string;
};

export type PilotOperationalSignal = {
  id: string;
  clinic_id: string;
  event: string;
  timestamp: string;
};

export type PilotMetricInput = {
  conversations: PilotConversation[];
  calls: PilotCallSession[];
  tools: PilotToolInvocation[];
  appointments: PilotAppointment[];
  messages: PilotMessage[];
  events: PilotEvent[];
  operationalSignals: PilotOperationalSignal[];
};

export type PilotMetrics = {
  conversationsTotal: number;
  conversationsByChannel: Record<Channel, number>;
  calls: number;
  appointmentsCreated: number;
  appointmentsModified: number;
  appointmentsCancelled: number;
  escalations: number;
  takeovers: number;
  toolsSucceeded: number;
  toolsFailed: number;
  assistantRequestFailures: number;
  averageResponseMs: number | null;
  averageCallDurationSeconds: number | null;
  automaticResolutionEligible: number;
  automaticResolutionCount: number;
  automaticResolutionRate: number | null;
};

const OUTCOME_TOOLS = new Set(["create_appointment", "modify_appointment", "cancel_appointment"]);

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function responseDurations(messages: PilotMessage[]): number[] {
  const byConversation = new Map<string, PilotMessage[]>();
  for (const message of messages) {
    const rows = byConversation.get(message.conversation_id) ?? [];
    rows.push(message);
    byConversation.set(message.conversation_id, rows);
  }

  const durations: number[] = [];
  for (const rows of byConversation.values()) {
    rows.sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at));
    for (let index = 0; index < rows.length; index += 1) {
      const inbound = rows[index];
      if (inbound?.sender !== "client" || inbound.direction !== "inbound") continue;
      const reply = rows
        .slice(index + 1)
        .find((candidate) => candidate.sender === "agent" && candidate.direction === "outbound");
      if (!reply) continue;
      const duration = Date.parse(reply.created_at) - Date.parse(inbound.created_at);
      if (duration >= 0) durations.push(duration);
    }
  }
  return durations;
}

/**
 * Pure, tenant-defensive pilot aggregation. The page already scopes every DB
 * query by clinic_id; this second filter makes accidental cross-tenant input
 * incapable of changing the displayed metrics.
 */
export function buildPilotMetrics(clinicId: string, input: PilotMetricInput): PilotMetrics {
  const conversations = input.conversations.filter((row) => row.clinic_id === clinicId);
  const calls = input.calls.filter((row) => row.clinic_id === clinicId);
  const tools = input.tools.filter((row) => row.clinic_id === clinicId);
  const appointments = input.appointments.filter((row) => row.clinic_id === clinicId);
  const messages = input.messages.filter((row) => row.clinic_id === clinicId);
  const events = input.events.filter((row) => row.clinic_id === clinicId);
  const signals = input.operationalSignals.filter((row) => row.clinic_id === clinicId);

  const successfulTools = tools.filter((row) => row.success);
  const escalatedConversationIds = new Set(
    successfulTools
      .filter((row) => row.tool_name === "escalate_to_human" && row.conversation_id)
      .map((row) => row.conversation_id as string),
  );
  const takeoverConversationIds = new Set(
    events
      .filter((row) => row.event_type === "conversation.human_takeover" && row.conversation_id)
      .map((row) => row.conversation_id as string),
  );
  for (const conversation of conversations) {
    if (conversation.controlled_at || conversation.status === "human_handling") {
      takeoverConversationIds.add(conversation.id);
    }
  }

  const outcomeConversationIds = new Set(
    successfulTools
      .filter((row) => OUTCOME_TOOLS.has(row.tool_name) && row.conversation_id)
      .map((row) => row.conversation_id as string),
  );
  const completed = conversations.filter(
    (row) =>
      row.status === "completed" || row.status === "transferred" || row.status === "abandoned",
  );
  const automaticallyResolved = completed.filter(
    (row) =>
      row.status === "completed" &&
      outcomeConversationIds.has(row.id) &&
      !escalatedConversationIds.has(row.id) &&
      !takeoverConversationIds.has(row.id),
  );
  const callDurations = calls.flatMap((row) =>
    typeof row.duration_seconds === "number" ? [row.duration_seconds] : [],
  );
  const responseMs = responseDurations(messages);

  return {
    conversationsTotal: conversations.length,
    conversationsByChannel: {
      web: conversations.filter((row) => row.channel === "web").length,
      whatsapp: conversations.filter((row) => row.channel === "whatsapp").length,
      phone: conversations.filter((row) => row.channel === "phone").length,
    },
    calls: calls.length,
    appointmentsCreated: appointments.filter((row) => row.created_by === "agent").length,
    appointmentsModified: successfulTools.filter((row) => row.tool_name === "modify_appointment")
      .length,
    appointmentsCancelled: successfulTools.filter((row) => row.tool_name === "cancel_appointment")
      .length,
    escalations: escalatedConversationIds.size,
    takeovers: takeoverConversationIds.size,
    toolsSucceeded: successfulTools.length,
    toolsFailed: tools.length - successfulTools.length,
    assistantRequestFailures: signals.filter((row) => row.event === "vapi.assistant_request.failed")
      .length,
    averageResponseMs: average(responseMs),
    averageCallDurationSeconds: average(callDurations),
    automaticResolutionEligible: completed.length,
    automaticResolutionCount: automaticallyResolved.length,
    automaticResolutionRate:
      completed.length === 0
        ? null
        : Math.round((automaticallyResolved.length / completed.length) * 1000) / 10,
  };
}
