import type { Database } from "@recepia/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ToolContext = {
  /** The clinic ID for which the agent is operating. */
  clinicId: string;
  /** The current conversation ID, or null if the tool is invoked outside a
   *  conversation (e.g. from a test page). */
  conversationId: string | null;
  /** Channel and call correlation are optional for panel/test invocations. */
  channel?: string;
  callSessionId?: string;
  /** True only when the current client turn explicitly confirms a proposal
   *  made by the Agent in the immediately preceding conversational turn. */
  appointmentConfirmed: boolean;
  /** The appointment mutation explicitly confirmed in the current client turn. */
  appointmentMutationConfirmed: "modify" | "cancel" | null;
  /** Supabase admin client (service_role, bypasses RLS). */
  supabaseAdmin: SupabaseClient<Database>;
  /** Lightweight logger — use for debugging and tracing. */
  logger: (msg: string, data?: unknown) => void;
};

export type ToolSuccess<T> = { success: true; data: T };

export type ToolFailure = {
  success: false;
  error: string;
  error_code?: string;
};

export type ToolResult<T> = ToolSuccess<T> | ToolFailure;

export interface Tool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  handler: (input: TInput, ctx: ToolContext) => Promise<ToolResult<TOutput>>;
}
