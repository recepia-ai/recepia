import { getAnthropicClient } from "./anthropic-client";
import { buildSystemPrompt } from "./system-prompt";
import { getTool, getAnthropicTools } from "./tools/registry";
import { invokeTool, buildToolContext } from "./tools/invoke-tool";
import { saveMessage } from "./conversation-store";
import type { MessageRecord } from "./conversation-store";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@recepia/db";
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
// Agent loop
// ---------------------------------------------------------------------------

export async function runAgentLoop(params: {
  conversationId: string;
  clinicId: string;
  userMessage: string;
  previousMessages: MessageRecord[];
  clientPhone?: string;
  supabaseAdmin: SupabaseClient<Database>;
}): Promise<LoopResult> {
  const { conversationId, clinicId, userMessage, previousMessages, clientPhone, supabaseAdmin } = params;

  const systemPrompt = buildSystemPrompt(clientPhone);
  const anthropic = getAnthropicClient();
  const tools = getAnthropicTools();

  // Build the initial messages array for Anthropic
  const anthropicMessages: AnthropicMessageParam[] = [
    ...toAnthropicMessages(previousMessages),
    { role: "user", content: userMessage },
  ];

  // Save the inbound user message to DB
  await saveMessage(supabaseAdmin, {
    conversationId,
    clinicId,
    direction: "inbound",
    sender: "client",
    content: userMessage,
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
        max_tokens: 1024,
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
      console.error(
        `[loop] Anthropic API error (iteration ${iteration}):`,
        apiErr instanceof Error ? apiErr.message : apiErr,
        apiErr instanceof Error && "status" in apiErr
          ? `status=${(apiErr as unknown as { status: unknown }).status}`
          : "",
      );
      console.error(
        "[loop] Full error:",
        JSON.stringify(apiErr, Object.getOwnPropertyNames(apiErr), 2),
      );
      throw apiErr;
    }

    // Separate text and tool_use blocks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textBlocks = response.content.filter((b: any) => b.type === "text");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolUseBlocks = response.content.filter((b: any) => b.type === "tool_use") as any[];

    // ---- Case 1: Final text response ----
    if (response.stop_reason === "end_turn") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      finalText = textBlocks.map((b: any) => ("text" in b ? (b as { text: string }).text : "")).join("");

      // Save agent message to DB
      await saveMessage(supabaseAdmin, {
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

      await saveMessage(supabaseAdmin, {
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
        await saveMessage(supabaseAdmin, {
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
        if (tu.name === "escalate_to_human" && toolResult.success) {
          // Save a final agent message
          await saveMessage(supabaseAdmin, {
            conversationId,
            clinicId,
            direction: "outbound",
            sender: "agent",
            content:
              "Te paso ahora mismo con una persona del equipo. Un momento, por favor.",
          });

          return {
            response:
              "Te paso ahora mismo con una persona del equipo. Un momento, por favor.",
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
    "Lo siento, estoy teniendo dificultades para procesar tu solicitud. ¿Podrías intentarlo de nuevo?";

  await saveMessage(supabaseAdmin, {
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
}
