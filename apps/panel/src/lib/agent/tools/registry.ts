import type { Tool } from "./types";
import { lookupClient } from "./lookup-client";
import { registerNewClient } from "./register-new-client";
import { lookupPetsByClient } from "./lookup-pets-by-client";
import { registerNewPet } from "./register-new-pet";
import { checkAvailabilityTool } from "./check-availability";
import { createAppointmentTool } from "./create-appointment";
import { escalateToHuman } from "./escalate-to-human";
import { findServiceByName } from "./find-service-by-name";

// ---------------------------------------------------------------------------
// Tool registry
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tools: Tool<any, any>[] = [
  lookupClient,
  registerNewClient,
  lookupPetsByClient,
  registerNewPet,
  checkAvailabilityTool,
  createAppointmentTool,
  findServiceByName,
  escalateToHuman,
];

const toolMap = new Map<string, Tool<any, any>>(tools.map((t) => [t.name, t]));

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getTool(name: string): Tool<any, any> | null {
  return toolMap.get(name) ?? null;
}

export function listTools(): Tool<any, any>[] {
  return tools;
}

/**
 * Build the Anthropic-compatible tools array for the Messages API.
 * Each tool has name, description, and input_schema (JSON Schema).
 */
export function getAnthropicTools(): Array<{
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}> {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema.toJSONSchema({ target: "jsonSchema7" }) as Record<string, unknown>,
  }));
}
