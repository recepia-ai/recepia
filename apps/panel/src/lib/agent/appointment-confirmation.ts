type ConfirmationMessage = {
  sender: string;
  content: string | null;
};

const AFFIRMATIVE_REPLY =
  /^(?:sí|si|confirmo|confirmado|de acuerdo|adelante|correcto|correcta|vale|ok)(?:[\s,.!¡;:]+(?:sí|si|confirmo|confirmado|de acuerdo|adelante|correcto|correcta|vale|ok|gracias|por favor|(?:la|el|esta|este|esa|ese)?\s*(?:cita|reserva|cancelación|cancelacion|modificación|modificacion|cambio)))*[\s.!¡]*$/i;

export type AppointmentConfirmationAction = "create" | "modify" | "cancel";

const CONFIRMATION_WORD = /\b(confirmas|confirmar|confirmación|confirmacion)\b/i;
const ACTION_WORDS: Record<AppointmentConfirmationAction, RegExp> = {
  create: /\b(reserv(?:e|ar|a)|agend(?:e|ar|a)|cre(?:e|ar|a))\b/i,
  modify:
    /\b(cambi(?:e|ar|o)|modific(?:a|ar|ación|acion)|reprogram(?:e|ar|ación|acion)|muev(?:a|e)|mover|añad(?:a|ir)|agreg(?:ue|ar)|actualiz(?:a|ar))\b/i,
  cancel: /\b(cancel(?:e|ar|ación|acion)|anul(?:e|ar|ación|acion))\b/i,
};

function matchesConfirmationQuestion(
  content: string,
  action: AppointmentConfirmationAction,
): boolean {
  if (!content.includes("?") || !CONFIRMATION_WORD.test(content)) return false;
  if (!ACTION_WORDS[action].test(content)) return false;

  if (action === "create") {
    return !ACTION_WORDS.modify.test(content) && !ACTION_WORDS.cancel.test(content);
  }

  return /\b(cita|reserva|fecha|hora|motivo|nota|notas)\b/i.test(content);
}

export function getExplicitAppointmentConfirmation(
  previousMessages: ConfirmationMessage[],
  currentUserMessage: string,
): AppointmentConfirmationAction | null {
  const conversationalHistory = previousMessages.filter(
    (message) => message.sender === "client" || message.sender === "agent",
  );
  const lastConversationalMessage = conversationalHistory.at(-1);

  if (
    lastConversationalMessage?.sender !== "agent" ||
    !lastConversationalMessage.content ||
    !AFFIRMATIVE_REPLY.test(currentUserMessage.trim())
  ) {
    return null;
  }

  for (const action of ["cancel", "modify", "create"] as const) {
    if (matchesConfirmationQuestion(lastConversationalMessage.content, action)) return action;
  }

  return null;
}

export function hasExplicitAppointmentConfirmation(
  previousMessages: ConfirmationMessage[],
  currentUserMessage: string,
): boolean {
  return getExplicitAppointmentConfirmation(previousMessages, currentUserMessage) === "create";
}
