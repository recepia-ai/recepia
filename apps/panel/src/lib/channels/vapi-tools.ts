import type { z } from "zod";
import type { AppointmentConfirmationAction } from "@/lib/agent/appointment-confirmation";
import { buildToolContext, invokeTool } from "@/lib/agent/tools/invoke-tool";
import { getTool, listTools } from "@/lib/agent/tools/registry";
import {
  type VapiFunctionCall,
  vapiToolCallArguments,
  vapiToolCallName,
  withVapiCallerIdentity,
} from "@/lib/channels/vapi-payload";
import {
  hasRelativeAvailabilityIntent,
  resolveRelativeAvailabilityInput,
} from "@/lib/channels/vapi-relative-availability";
import { operationalLog } from "@/lib/operational-logger";

// ---------------------------------------------------------------------------
// Vapi custom-function tools
//
// Reutiliza el mismo registry de tools que usa el agente de WhatsApp/web
// (apps/panel/src/lib/agent/tools) para que Recepia pueda reservar, cancelar
// y consultar citas por telefono (voz) sin duplicar logica.
//
// - buildVapiToolDefinitions(): genera el array de tools en el formato que
//   espera Vapi (para declararlas en el assistant).
// - handleVapiToolCalls(): ejecuta las tool-calls que Vapi envia al webhook
//   durante una llamada y devuelve los resultados en el formato de Vapi.
// ---------------------------------------------------------------------------

/** Definicion de una tool en el formato de Vapi (custom function). */
export type VapiToolDefinition = {
  type: "function";
  async: false;
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

/**
 * Genera las definiciones de tools para el assistant de Vapi a partir del
 * registry del agente. El schema de parametros sale del Zod de cada tool.
 *
 * No se fija `server` por tool: Vapi las enruta al server URL de la llamada
 * (el del numero de telefono, que lleva la cabecera x-vapi-secret), de modo
 * que las tool-calls llegan autenticadas al mismo webhook.
 */
export function buildVapiToolDefinitions(): VapiToolDefinition[] {
  return listTools().map((tool) => ({
    type: "function",
    async: false,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: (tool.inputSchema as z.ZodType).toJSONSchema({
        target: "jsonSchema7",
      }) as Record<string, unknown>,
    },
  }));
}

// ---------------------------------------------------------------------------
// Ejecucion de tool-calls
// ---------------------------------------------------------------------------

export type { VapiFunctionCall } from "@/lib/channels/vapi-payload";

export type VapiToolResult = { name: string; toolCallId: string; result: string };

type VapiToolExecution = {
  callId: string;
  callSessionId?: string;
  callerPhone?: string;
  confirmation: AppointmentConfirmationAction | null;
  recentUserMessages?: string[];
};

/**
 * Ejecuta una lista de tool-calls de Vapi contra el registry del agente y
 * devuelve los resultados en el formato { results: [{ toolCallId, result }] }.
 *
 * `result` siempre es un string (Vapi lo devuelve al LLM): un JSON con los
 * datos en caso de exito, o un mensaje de error legible en caso de fallo.
 */
export async function handleVapiToolCalls(
  clinicId: string,
  conversationId: string | null,
  toolCalls: VapiFunctionCall[],
  execution: VapiToolExecution,
): Promise<{ results: VapiToolResult[] }> {
  const ctx = buildToolContext(
    clinicId,
    conversationId,
    execution.confirmation === "create",
    execution.confirmation === "modify" || execution.confirmation === "cancel"
      ? execution.confirmation
      : null,
    { channel: "phone", callSessionId: execution.callSessionId },
  );
  const { data: clinic } = await ctx.supabaseAdmin
    .from("clinics")
    .select("timezone")
    .eq("id", clinicId)
    .maybeSingle();
  const timezone = clinic?.timezone ?? "Europe/Madrid";
  const currentUserMessage = execution.recentUserMessages?.at(-1) ?? null;
  const relativeMessage =
    currentUserMessage && hasRelativeAvailabilityIntent(currentUserMessage)
      ? currentUserMessage
      : null;

  const results = await Promise.all(
    toolCalls.map(async (call): Promise<VapiToolResult> => {
      const toolCallId = call.id ?? "";
      const name = vapiToolCallName(call);
      const providerInput = withVapiCallerIdentity(
        name,
        vapiToolCallArguments(call),
        execution.callerPhone,
      );
      const relativeResolution =
        name === "check_availability"
          ? resolveRelativeAvailabilityInput(providerInput, relativeMessage ?? null, timezone)
          : { input: providerInput, relativeExpression: null };
      const input = relativeResolution.input;
      const tool = getTool(name);

      if (!toolCallId) {
        return {
          name,
          toolCallId,
          result: JSON.stringify({
            success: false,
            error: "Vapi no proporcionó un identificador para esta tool-call.",
            error_code: "MISSING_TOOL_CALL_ID",
          }),
        };
      }

      const eventId = `${execution.callId}:tool:${toolCallId}`;
      const { error: claimError } = await ctx.supabaseAdmin.from("channel_events").insert({
        clinic_id: clinicId,
        conversation_id: conversationId,
        channel: "phone",
        provider: "vapi",
        event_id: eventId,
        event_type: `tool-calls:${name || "unknown"}`,
        status: "processing",
        payload: JSON.parse(
          JSON.stringify({
            call_id: execution.callId,
            tool_call_id: toolCallId,
            tool_name: name,
            input,
            ...(relativeResolution.relativeExpression
              ? {
                  provider_input: providerInput,
                  relative_date_corrected: true,
                  timezone,
                }
              : {}),
          }),
        ),
        occurred_at: new Date().toISOString(),
      });

      if (claimError?.code === "23505") {
        const { data: existing } = await ctx.supabaseAdmin
          .from("channel_events")
          .select("status, result")
          .eq("clinic_id", clinicId)
          .eq("provider", "vapi")
          .eq("event_id", eventId)
          .maybeSingle();
        const stored = existing?.result as { tool_result?: unknown } | null;
        if (typeof stored?.tool_result === "string") {
          operationalLog("info", "tool.duplicate", {
            clinic_id: clinicId,
            conversation_id: conversationId ?? undefined,
            call_session_id: execution.callSessionId,
            channel: "phone",
            provider: "vapi",
            event_id: eventId,
            tool: name,
            duplicate: true,
          });
          return { name, toolCallId, result: stored.tool_result };
        }
        return {
          name,
          toolCallId,
          result: JSON.stringify({
            success: false,
            error: "Esta operación ya se está procesando. No la repitas todavía.",
            error_code: "TOOL_CALL_IN_PROGRESS",
          }),
        };
      }
      if (claimError) throw claimError;

      let result: string;

      if (!tool) {
        result = JSON.stringify({
          success: false,
          error: `Tool desconocida: ${name}`,
          error_code: "UNKNOWN_TOOL",
        });
      } else {
        const parsed = tool.inputSchema.safeParse(input);
        if (!parsed.success) {
          result = JSON.stringify({
            success: false,
            error: `Parametros invalidos para ${name}: ${parsed.error.message}`,
            error_code: "INVALID_TOOL_ARGUMENTS",
          });
        } else {
          const outcome = await invokeTool(tool, parsed.data, ctx);
          result = JSON.stringify(outcome);
        }
      }

      const parsedResult = JSON.parse(result) as { success?: boolean; error?: string };
      const { error: evidenceError } = await ctx.supabaseAdmin
        .from("channel_events")
        .update({
          status: parsedResult.success ? "completed" : "failed",
          result: { tool_result: result },
          error_message: parsedResult.success ? null : (parsedResult.error ?? "Tool fallida"),
          processed_at: new Date().toISOString(),
        })
        .eq("clinic_id", clinicId)
        .eq("provider", "vapi")
        .eq("event_id", eventId);
      if (evidenceError) {
        console.error(`[vapi] could not finalize tool evidence for ${name}`, evidenceError);
      }

      return { name, toolCallId, result };
    }),
  );

  return { results };
}
