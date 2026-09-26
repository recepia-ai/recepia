/** Pilot default applied to every dynamic Vapi call. */
export const VAPI_PILOT_ARTIFACT_PLAN = {
  recordingEnabled: false,
  videoRecordingEnabled: false,
  pcapEnabled: false,
  loggingEnabled: true,
  transcriptPlan: {
    enabled: true,
    assistantName: "Recepia",
    userName: "Cliente",
  },
} as const;

const CALL_STATUS_ORDER: Record<string, number> = {
  queued: 0,
  ringing: 1,
  in_progress: 2,
  completed: 3,
  failed: 3,
  transferred: 3,
};

export function monotonicCallStatus(existing: string, incoming: string | null): string {
  if (!incoming) return existing;
  return (CALL_STATUS_ORDER[incoming] ?? 0) >= (CALL_STATUS_ORDER[existing] ?? 0)
    ? incoming
    : existing;
}

export function vapiEventIdentity(
  callId: string,
  type: string,
  discriminator: string | number | null | undefined,
): string {
  return `${callId}:${type}:${discriminator ?? "event"}`;
}

export function vapiDisabledAssistantResponse(
  assistantId: string,
  firstMessage: string,
): Record<string, unknown> {
  return {
    assistantId,
    assistantOverrides: {
      artifactPlan: VAPI_PILOT_ARTIFACT_PLAN,
      firstMessage,
      model: {
        tools: [],
        messages: [
          {
            role: "system",
            content:
              "La automatización está desactivada. No ejecutes tools ni confirmes operaciones. Explica que el equipo revisará la llamada y finaliza de forma cordial.",
          },
        ],
      },
    },
  };
}
