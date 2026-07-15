import { z } from "zod";
import { uuidSchema } from "@/lib/uuid-schema";
import { checkAvailability } from "@/app/(app)/_actions/availability-actions";
import type { Tool, ToolResult, ToolContext } from "./types";

// ---------------------------------------------------------------------------
// check_availability
// ---------------------------------------------------------------------------

const inputSchema = z.object({
  service_id: uuidSchema,
  date_from: z.string().datetime(),
  date_to: z.string().datetime(),
  vet_user_id: uuidSchema.optional(),
});

type Input = z.infer<typeof inputSchema>;

type Slot = {
  vet_user_id: string;
  vet_name: string;
  starts_at: string;
  ends_at: string;
  calendar_id: string;
};

type Output =
  | { slots: Slot[] }
  | { error: string };

async function handler(input: Input, _ctx: ToolContext): Promise<ToolResult<Output>> {
  // checkAvailability does its own auth via getCallerClinicId()
  const result = await checkAvailability(input);

  if ("error" in result) {
    return { success: false, error: result.error };
  }

  return { success: true, data: { slots: result.slots } };
}

export const checkAvailabilityTool: Tool<Input, Output> = {
  name: "check_availability",
  description:
    "Consulta huecos disponibles para agendar una cita. Devuelve slots concretos (día, hora, veterinario). El sistema ya filtra por horario de consulta del vet y por asignaciones servicio-veterinario. Solo propón slots que esta tool devuelva — NUNCA inventes horarios.",
  inputSchema,
  handler,
};
