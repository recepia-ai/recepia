import type { z } from "zod";
import { buildToolContext, invokeTool } from "@/lib/agent/tools/invoke-tool";
import { getTool, listTools } from "@/lib/agent/tools/registry";

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

export type VapiFunctionCall = {
  id?: string;
  name?: string;
  arguments?: unknown;
  function?: { name?: string; arguments?: unknown };
};

export type VapiToolResult = { toolCallId: string; result: string };

function parseArguments(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function callName(call: VapiFunctionCall): string {
  return call.function?.name ?? call.name ?? "";
}

function callArgs(call: VapiFunctionCall): Record<string, unknown> {
  return parseArguments(call.function?.arguments ?? call.arguments);
}

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
): Promise<{ results: VapiToolResult[] }> {
  const ctx = buildToolContext(clinicId, conversationId);

  const results = await Promise.all(
    toolCalls.map(async (call): Promise<VapiToolResult> => {
      const toolCallId = call.id ?? "";
      const name = callName(call);
      const tool = getTool(name);

      if (!tool) {
        return {
          toolCallId,
          result: JSON.stringify({
            success: false,
            error: `Tool desconocida: ${name}`,
          }),
        };
      }

      const parsed = tool.inputSchema.safeParse(callArgs(call));
      if (!parsed.success) {
        return {
          toolCallId,
          result: JSON.stringify({
            success: false,
            error: `Parametros invalidos para ${name}: ${parsed.error.message}`,
          }),
        };
      }

      const outcome = await invokeTool(tool, parsed.data, ctx);
      return { toolCallId, result: JSON.stringify(outcome) };
    }),
  );

  return { results };
}
