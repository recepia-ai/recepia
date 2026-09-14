type ConfirmationMessage = {
  sender: string;
  content: string | null;
};

const CONFIRMATION_QUESTION =
  /\b(confirmas|confirmar|confirmación|confirmacion)\b[^?]*\b(cita|reserva|reserve|reservar)\b[^?]*\?/i;
const AFFIRMATIVE_REPLY =
  /^(sí|si|confirmo|confirmado|de acuerdo|adelante|correcto|correcta|vale|ok)([\s,.!¡;:]|$)/i;

export function hasExplicitAppointmentConfirmation(
  previousMessages: ConfirmationMessage[],
  currentUserMessage: string,
): boolean {
  const conversationalHistory = previousMessages.filter(
    (message) => message.sender === "client" || message.sender === "agent",
  );
  const lastConversationalMessage = conversationalHistory.at(-1);

  return Boolean(
    lastConversationalMessage?.sender === "agent" &&
      lastConversationalMessage.content &&
      CONFIRMATION_QUESTION.test(lastConversationalMessage.content) &&
      AFFIRMATIVE_REPLY.test(currentUserMessage.trim()),
  );
}
