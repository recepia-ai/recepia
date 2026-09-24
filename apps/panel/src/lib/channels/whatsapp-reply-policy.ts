type AutomatedReplyResult = {
  response: string | null;
  duplicate: boolean;
};

export function shouldSendAutomatedWhatsAppReply(result: AutomatedReplyResult): boolean {
  return Boolean(result.response) && !result.duplicate;
}
