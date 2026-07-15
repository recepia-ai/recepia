"use server";

import { getAnthropicClient } from "@/lib/agent/anthropic-client";
import { getAdminClinicId } from "@/app/(app)/settings/test-availability/_actions/test-helpers";

// ---------------------------------------------------------------------------
// Ping test — verifies Anthropic SDK connectivity end-to-end
// ---------------------------------------------------------------------------

export type PingResult = {
  success: boolean;
  model?: string;
  response_text?: string;
  usage?: { input_tokens: number; output_tokens: number };
  elapsed_ms?: number;
  error?: string;
  error_details?: unknown;
};

export async function pingAnthropic(): Promise<PingResult> {
  // Admin guard
  const clinicIdOrError = await getAdminClinicId();
  if (typeof clinicIdOrError !== "string") {
    return { success: false, error: clinicIdOrError.error };
  }

  const startedAt = Date.now();

  try {
    const client = getAnthropicClient();

    const msg = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: "Responde exactamente con la frase 'ping OK desde Recepia'",
        },
      ],
    });

    const elapsedMs = Date.now() - startedAt;

    const text =
      msg.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim() || "(sin texto)";

    return {
      success: true,
      model: msg.model,
      response_text: text,
      usage: msg.usage
        ? {
            input_tokens: msg.usage.input_tokens,
            output_tokens: msg.usage.output_tokens,
          }
        : undefined,
      elapsed_ms: elapsedMs,
    };
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error desconocido",
      error_details: err instanceof Error ? err.stack : String(err),
      elapsed_ms: elapsedMs,
    };
  }
}
