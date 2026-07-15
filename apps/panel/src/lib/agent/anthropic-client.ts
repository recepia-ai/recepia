import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Anthropic client factory (server-side only)
// ---------------------------------------------------------------------------

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (_client) return _client;

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY no está configurada en el entorno del servidor.",
    );
  }

  _client = new Anthropic({ apiKey });
  return _client;
}
