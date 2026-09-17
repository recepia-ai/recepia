export type VapiFunctionCall = {
  id?: string;
  name?: string;
  arguments?: unknown;
  parameters?: unknown;
  function?: {
    name?: string;
    arguments?: unknown;
    parameters?: unknown;
  };
};

type VapiArtifactMessage = {
  role?: unknown;
  message?: unknown;
  content?: unknown;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function extractVapiToolCalls(payload: unknown): VapiFunctionCall[] {
  const message = record(record(payload)?.message);
  if (!message) return [];

  const directCalls = message.toolCallList;
  if (Array.isArray(directCalls)) return directCalls as VapiFunctionCall[];

  const wrappedCalls = message.toolWithToolCallList;
  if (!Array.isArray(wrappedCalls)) return [];

  return wrappedCalls.flatMap((wrapped) => {
    const wrapper = record(wrapped);
    const toolCall = record(wrapper?.toolCall);
    if (!toolCall) return [];

    const fn = record(toolCall.function);
    return [
      {
        id: typeof toolCall.id === "string" ? toolCall.id : undefined,
        name:
          typeof toolCall.name === "string"
            ? toolCall.name
            : typeof fn?.name === "string"
              ? fn.name
              : typeof wrapper?.name === "string"
                ? wrapper.name
                : undefined,
        arguments: toolCall.arguments,
        parameters: toolCall.parameters,
        function: fn
          ? {
              name: typeof fn.name === "string" ? fn.name : undefined,
              arguments: fn.arguments,
              parameters: fn.parameters,
            }
          : undefined,
      },
    ];
  });
}

export function vapiToolCallName(call: VapiFunctionCall): string {
  return call.function?.name ?? call.name ?? "";
}

export function vapiToolCallArguments(call: VapiFunctionCall): Record<string, unknown> {
  const raw =
    call.function?.arguments ?? call.function?.parameters ?? call.arguments ?? call.parameters;

  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return record(parsed) ?? {};
    } catch {
      return {};
    }
  }
  return record(raw) ?? {};
}

function messageText(message: VapiArtifactMessage): string | null {
  if (typeof message.message === "string") return message.message.trim() || null;
  if (typeof message.content === "string") return message.content.trim() || null;
  if (!Array.isArray(message.content)) return null;

  const text = message.content
    .map((part) => {
      const item = record(part);
      return item?.type === "text" && typeof item.text === "string" ? item.text : "";
    })
    .join("")
    .trim();
  return text || null;
}

export function vapiConfirmationConversation(payload: unknown): {
  previousMessages: Array<{ sender: "client" | "agent"; content: string }>;
  currentUserMessage: string | null;
} {
  const message = record(record(payload)?.message);
  const artifact = record(message?.artifact);
  const artifactMessages = artifact?.messages;
  if (!Array.isArray(artifactMessages)) {
    return { previousMessages: [], currentUserMessage: null };
  }

  const turns = artifactMessages.flatMap((raw) => {
    const item = record(raw) as VapiArtifactMessage | null;
    const role = item?.role;
    const content = item ? messageText(item) : null;
    if ((role !== "user" && role !== "assistant") || !content) return [];
    return [{ sender: role === "user" ? ("client" as const) : ("agent" as const), content }];
  });

  let currentUserIndex = -1;
  for (let index = turns.length - 1; index >= 0; index--) {
    if (turns[index]?.sender === "client") {
      currentUserIndex = index;
      break;
    }
  }
  if (currentUserIndex < 0) return { previousMessages: [], currentUserMessage: null };

  return {
    previousMessages: turns.slice(0, currentUserIndex),
    currentUserMessage: turns[currentUserIndex]?.content ?? null,
  };
}

export function isFinalVapiTranscript(type: string, transcriptType?: string): boolean {
  return (
    (type === "transcript" && transcriptType === "final") ||
    type === 'transcript[transcriptType="final"]'
  );
}

export function vapiOccurredAt(timestamp: string | number | undefined): string {
  if (typeof timestamp === "string") {
    const parsed = Date.parse(timestamp);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    const milliseconds = timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
    return new Date(milliseconds).toISOString();
  }
  return new Date().toISOString();
}
