import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Tool,
  ToolResult,
  ToolContext,
  ToolSuccess,
  ToolFailure,
} from "./types";

// ---------------------------------------------------------------------------
// invokeTool — generic wrapper that records to tool_invocations
// ---------------------------------------------------------------------------

/**
 * Invoke a tool with the given input and context.
 *
 * Wraps the tool handler with:
 * 1. Duration tracking
 * 2. Automatic INSERT into tool_invocations
 * 3. Error capture (handler exceptions → ToolFailure)
 *
 * The tool's handler is called with the admin client from the context.
 */
export async function invokeTool<TInput, TOutput>(
  tool: Tool<TInput, TOutput>,
  input: TInput,
  ctx: ToolContext,
): Promise<ToolResult<TOutput>> {
  const startedAt = Date.now();

  let result: ToolResult<TOutput>;

  try {
    result = await tool.handler(input, ctx);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    ctx.logger(`[${tool.name}] handler threw: ${message}`, err);
    result = { success: false, error: message };
  }

  const durationMs = Date.now() - startedAt;

  // ------------------------------------------------------------------
  // Record to tool_invocations.
  //
  // Fire-and-forget: el registro es para debug/auditoría, no bloquea
  // la respuesta al usuario. Pero los errores SÍ se loguean en
  // console.error para visibilidad inmediata en terminal dev.
  // ------------------------------------------------------------------
  try {
    const { error: insertErr } = await (ctx.supabaseAdmin
      .from("tool_invocations") as any)
      .insert({
        clinic_id: ctx.clinicId,
        conversation_id: ctx.conversationId,
        tool_name: tool.name,
        input,
        output: result.success ? (result as ToolSuccess<TOutput>).data : null,
        success: result.success,
        error_code: result.success ? null : (result as ToolFailure).error_code ?? null,
        error_message: result.success ? null : (result as ToolFailure).error,
        duration_ms: durationMs,
      });

    if (insertErr) {
      console.error(
        `[${tool.name}] tool_invocations INSERT error:`,
        JSON.stringify(insertErr, null, 2),
      );
      ctx.logger(
        `[${tool.name}] failed to record tool_invocation`,
        insertErr,
      );
    }
  } catch (dbErr) {
    console.error(
      `[${tool.name}] tool_invocations INSERT exception:`,
      dbErr instanceof Error ? dbErr.message : dbErr,
    );
    ctx.logger(
      `[${tool.name}] tool_invocations INSERT exception`,
      dbErr instanceof Error ? dbErr.message : dbErr,
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helper to build a ToolContext from a clinic ID (used by test pages and
// the agent loop).
// ---------------------------------------------------------------------------

export function buildToolContext(
  clinicId: string,
  conversationId: string | null = null,
): ToolContext {
  return {
    clinicId,
    conversationId,
    supabaseAdmin: createAdminClient(),
    logger: (msg: string, data?: unknown) => {
      console.log(`[ToolContext] ${msg}`, data ?? "");
    },
  };
}
