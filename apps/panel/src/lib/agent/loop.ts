import type { Database } from "@recepia/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient } from "./anthropic-client";
import { CLINIC_ADDRESS, CLINIC_NAME, EMERGENCY_HOSPITAL_PHONE } from "./clinic-data";
import type { MessageRecord } from "./conversation-store";
import { saveMessage } from "./conversation-store";
import { buildSystemPrompt } from "./system-prompt";
import { buildToolContext, invokeTool } from "./tools/invoke-tool";
import { getAnthropicTools, getTool } from "./tools/registry";
import type { ToolResult } from "./tools/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToolCallRecord = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output: ToolResult<unknown>;
};

export type LoopResult = {
  /** Final text response from the agent. */
  response: string;
  /** All tool calls made during this turn (for debug display). */
  toolCalls: ToolCallRecord[];
  /** Whether the conversation was terminated (escalated or ended). */
  terminated: boolean;
};

/** Shape of an Anthropic message param (simplified for our use). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnthropicMessageParam = Record<string, any>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_TOOL_ITERATIONS = 10;

const ESCALATION_MESSAGES: Record<string, string> = {
  urgent_medical: `Entiendo que la situacion es urgente. No esperes mas, ven ahora mismo al ${CLINIC_NAME}. Estamos en ${CLINIC_ADDRESS}. Si lo prefieres, contacta con Anicura Tarragona (${EMERGENCY_HOSPITAL_PHONE}). Te paso con el equipo para que te confirmen que todo esta preparado.`,
  complaint:
    "Lamento mucho que hayas tenido esa experiencia. Tomo nota de tu queja y la traslado al equipo. Alguien del hospital se pondra en contacto contigo hoy para resolverlo personalmente.",
  medication_query:
    "Entiendo tu consulta, pero por seguridad no puedo recomendar medicacion ni dosis a traves de este chat. El veterinario debe valorar el estado actual de tu mascota antes de pautar nada. Te paso con el equipo para que te atiendan.",
  surgery_pricing:
    "Entiendo que quieras saber el precio. Los presupuestos de cirugia dependen de cada caso concreto (peso, complejidad, pruebas previas) y prefiero que el equipo te lo confirme directamente. Te paso con ellos para que te den un presupuesto personalizado.",
  grief:
    "Lo siento mucho. Se que es un momento dificil. El equipo del hospital esta preparado para ayudarte con lo que necesites. Te paso ahora mismo con una persona que podra atenderte.",
  client_request: "Te paso ahora mismo con una persona del equipo. Un momento, por favor.",
  ambiguity_unresolved: "Te paso ahora mismo con una persona del equipo. Un momento, por favor.",
  other: "Te paso ahora mismo con una persona del equipo. Un momento, por favor.",
};

// ---------------------------------------------------------------------------
// DB message → Anthropic message conversion
// ---------------------------------------------------------------------------

/**
 * Convert a list of DB message rows into the Anthropic Messages API format.
 *
 * Rules:
 * - client → { role: "user", content: text }
 * - agent (no tool metadata) → { role: "assistant", content: [{ type: "text", text }] }
 * - system with tool_uses metadata → { role: "assistant", content: [ToolUseBlock...] }
 * - system with tool_result metadata → { role: "user", content: [ToolResultBlock...] }
 */
function toAnthropicMessages(messages: MessageRecord[]): AnthropicMessageParam[] {
  const result: AnthropicMessageParam[] = [];

  for (const msg of messages) {
    const meta = msg.metadata as Record<string, unknown> | null;

    if (msg.sender === "client") {
      result.push({ role: "user", content: msg.content ?? "" });
    } else if (msg.sender === "agent") {
      result.push({
        role: "assistant",
        content: [{ type: "text", text: msg.content ?? "" }],
      });
    } else if (msg.sender === "system" && meta) {
      if (meta.tool_uses) {
        // Assistant message with tool_use blocks
        const toolUses = meta.tool_uses as Array<{
          id: string;
          name: string;
          input: Record<string, unknown>;
        }>;
        result.push({
          role: "assistant",
          content: toolUses.map((tu) => ({
            type: "tool_use",
            id: tu.id,
            name: tu.name,
            input: tu.input,
          })),
        });
      } else if (meta.tool_result) {
        // User message with tool_result block
        const tr = meta.tool_result as {
          tool_use_id: string;
          name: string;
          output: ToolResult<unknown>;
        };
        result.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: tr.tool_use_id,
              content: JSON.stringify(tr.output),
            },
          ],
        });
      }
      // Other system messages (e.g. human-sent via panel) are skipped
      // in the agent history to avoid confusing the model.
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Safe wrapper around saveMessage that never throws.
 * AI-generated message persistence is best-effort: if the DB is down, we log
 * the error but do NOT crash the conversation. The client still gets a response.
 */
async function safeSaveMessage(
  supabaseAdmin: SupabaseClient<Database>,
  params: {
    conversationId: string;
    clinicId: string;
    direction: "inbound" | "outbound";
    sender: "client" | "agent" | "human" | "system";
    content: string | null;
    contentType?: string;
    metadata?: Record<string, unknown>;
    providerMessageId?: string;
  },
): Promise<void> {
  try {
    await saveMessage(supabaseAdmin, params);
  } catch (err) {
    console.error(
      "[loop] saveMessage failed (non-fatal):",
      err instanceof Error ? err.message : err,
    );
  }
}

// ---------------------------------------------------------------------------
// Agent loop
// ---------------------------------------------------------------------------

export async function runAgentLoop(params: {
  conversationId: string;
  clinicId: string;
  userMessage: string;
  previousMessages: MessageRecord[];
  clientPhone?: string;
  inboundProviderMessageId?: string;
  supabaseAdmin: SupabaseClient<Database>;
}): Promise<LoopResult> {
  const {
    conversationId,
    clinicId,
    userMessage,
    previousMessages,
    clientPhone,
    inboundProviderMessageId,
    supabaseAdmin,
  } = params;

  try {
    const systemPrompt = buildSystemPrompt(clientPhone);
    const anthropic = getAnthropicClient();
    const tools = getAnthropicTools();

    // Build the initial messages array for Anthropic
    const anthropicMessages: AnthropicMessageParam[] = [
      ...toAnthropicMessages(previousMessages),
      { role: "user", content: userMessage },
    ];

    // Save the inbound user message to DB
    await safeSaveMessage(supabaseAdmin, {
      conversationId,
      clinicId,
      direction: "inbound",
      sender: "client",
      content: userMessage,
      providerMessageId: inboundProviderMessageId,
    });

    const allToolCalls: ToolCallRecord[] = [];
    let finalText = "";

    // ---- Main loop ----
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let response: any;
      try {
        response = await anthropic.messages.create({
          model: "claude-sonnet-5",
          max_tokens: 4096,
          system: systemPrompt,
          messages: anthropicMessages as Array<{
            role: "user" | "assistant";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content: any;
          }>,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tools: tools as any,
        });
      } catch (apiErr) {
        const statusCode =
          apiErr instanceof Error && "status" in apiErr
            ? (apiErr as unknown as { status: number }).status
            : undefined;
        console.error(
          `[loop] Anthropic API error at iteration ${iteration} (status=${statusCode}):`,
          apiErr instanceof Error ? apiErr.message : apiErr,
        );

        const isOverloaded = statusCode === 429 || statusCode === 529;
        const errorText = isOverloaded
          ? "Estamos recibiendo muchas consultas. He tomado nota de tu mensaje y alguien del equipo te responderá en cuanto podamos."
          : `Estamos teniendo un problema técnico. He tomado nota de tu mensaje y alguien del equipo te responderá en breve. Si es urgente, por favor llama al ${CLINIC_NAME}.`;

        await safeSaveMessage(supabaseAdmin, {
          conversationId,
          clinicId,
          direction: "outbound",
          sender: "agent",
          content: errorText,
        });

        return {
          response: errorText,
          toolCalls: allToolCalls,
          terminated: true,
        };
      }

      // Separate text and tool_use blocks
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textBlocks = response.content.filter((b: any) => b.type === "text");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolUseBlocks = response.content.filter((b: any) => b.type === "tool_use") as any[];

      // ---- Case 1: Final text response ----
      if (response.stop_reason === "end_turn") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        finalText = textBlocks
          .map((b: any) => ("text" in b ? (b as { text: string }).text : ""))
          .join("");

        // Save agent message to DB
        await safeSaveMessage(supabaseAdmin, {
          conversationId,
          clinicId,
          direction: "outbound",
          sender: "agent",
          content: finalText,
        });

        return {
          response: finalText,
          toolCalls: allToolCalls,
          terminated: false,
        };
      }

      // ---- Case 2: Tool use ----
      if (response.stop_reason === "tool_use" && toolUseBlocks.length > 0) {
        // Save the assistant message with tool_use metadata
        const toolUseData = toolUseBlocks.map((tu) => ({
          id: tu.id as string,
          name: tu.name as string,
          input: (tu.input as Record<string, unknown>) ?? {},
        }));

        const toolUseSummary = toolUseData.map((tu) => `[tool_use: ${tu.name}]`).join(", ");

        await safeSaveMessage(supabaseAdmin, {
          conversationId,
          clinicId,
          direction: "outbound",
          sender: "system",
          content: toolUseSummary,
          contentType: "tool_call",
          metadata: { tool_uses: toolUseData },
        });

        // Add assistant message (with tool_use blocks) to conversation
        anthropicMessages.push({
          role: "assistant",
          content: toolUseBlocks.map((tu) => ({
            type: "tool_use",
            id: tu.id,
            name: tu.name,
            input: tu.input,
          })),
        });

        // Execute each tool and collect results
        const toolResultBlocks: Array<Record<string, unknown>> = [];

        for (const tu of toolUseBlocks) {
          const tool = getTool(tu.name as string);
          let toolResult: ToolResult<unknown>;

          if (!tool) {
            toolResult = {
              success: false,
              error: `Tool desconocida: ${tu.name}`,
              error_code: "UNKNOWN_TOOL",
            };
          } else {
            const ctx = buildToolContext(clinicId, conversationId);
            toolResult = await invokeTool(tool, tu.input as Record<string, unknown>, ctx);
          }

          allToolCalls.push({
            id: tu.id as string,
            name: tu.name as string,
            input: (tu.input as Record<string, unknown>) ?? {},
            output: toolResult,
          });

          toolResultBlocks.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: JSON.stringify(toolResult),
          });

          // Save each tool result as a system message
          await safeSaveMessage(supabaseAdmin, {
            conversationId,
            clinicId,
            direction: "inbound",
            sender: "system",
            content: `[tool_result: ${tu.name}]`,
            contentType: "tool_result",
            metadata: {
              tool_result: {
                tool_use_id: tu.id,
                name: tu.name,
                output: toolResult,
              },
            },
          });

          // If escalation tool was invoked, terminate the loop
          if (tu.name === "escalate_to_human") {
            if (toolResult.success) {
              const escalationReason =
                ((tu.input as Record<string, unknown> | undefined)?.reason as string | undefined) ??
                "other";
              const escalationMessage =
                ESCALATION_MESSAGES[escalationReason] ??
                "Te paso ahora mismo con una persona del equipo. Un momento, por favor.";

              await safeSaveMessage(supabaseAdmin, {
                conversationId,
                clinicId,
                direction: "outbound",
                sender: "agent",
                content: escalationMessage,
              });

              return {
                response: escalationMessage,
                toolCalls: allToolCalls,
                terminated: true,
              };
            }

            // escalate_to_human failed — send emergency message directly
            console.error(
              "[loop] escalate_to_human tool failed:",
              toolResult.error ?? "unknown error",
            );

            const failMessage =
              "Estoy teniendo problemas para conectar con el equipo en este momento. Por favor, llama al hospital directamente o acude sin cita si es urgente.";

            await safeSaveMessage(supabaseAdmin, {
              conversationId,
              clinicId,
              direction: "outbound",
              sender: "agent",
              content: failMessage,
            });

            return {
              response: failMessage,
              toolCalls: allToolCalls,
              terminated: true,
            };
          }
        }

        // Add tool results to conversation (as user role)
        anthropicMessages.push({
          role: "user",
          content: toolResultBlocks,
        });

        // Continue to next iteration
        continue;
      }

      // Unexpected stop_reason — log and fall through to fallback
      console.error(
        `[loop] Unexpected stop_reason at iteration ${iteration}:`,
        `stop_reason="${response.stop_reason}"`,
        `content_blocks=${response.content.length}`,
        `content_types=[${response.content.map((b: Record<string, unknown>) => b.type).join(", ")}]`,
      );
      break;
    }

    // Max iterations reached or unexpected stop_reason — force a fallback response
    console.error(
      `[loop] Fallback triggered — iterations exhausted or unexpected stop_reason. Tool calls made: ${allToolCalls.length}`,
    );
    const fallbackText =
      "Disculpa las molestias. No he podido completar tu solicitud en este momento. El equipo del hospital la revisará y te responderá pronto. Si es urgente, por favor llama al hospital directamente.";

    await safeSaveMessage(supabaseAdmin, {
      conversationId,
      clinicId,
      direction: "outbound",
      sender: "agent",
      content: fallbackText,
    });

    return {
      response: fallbackText,
      toolCalls: allToolCalls,
      terminated: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[loop] Unhandled error in runAgentLoop:", message, err);

    const emergencyText =
      "Disculpa, estamos experimentando un problema técnico. Si tu consulta es urgente, por favor llama al hospital. Si no, alguien del equipo te responderá en cuanto se resuelva.";

    try {
      await saveMessage(supabaseAdmin, {
        conversationId,
        clinicId,
        direction: "outbound",
        sender: "agent",
        content: emergencyText,
      });
    } catch (saveErr) {
      console.error("[loop] Emergency message save failed:", saveErr);
    }

    return {
      response: emergencyText,
      toolCalls: [],
      terminated: false,
    };
  }
}
