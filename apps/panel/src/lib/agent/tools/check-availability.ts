import { z } from "zod";
import { checkAvailabilityForClinic } from "@/lib/availability-core";
import { uuidSchema } from "@/lib/uuid-schema";
import type { Tool, ToolContext, ToolResult } from "./types";

const inputSchema = z.object({
  service_id: uuidSchema,
  date_from: z.string().datetime({ offset: true }),
  date_to: z.string().datetime({ offset: true }),
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

type Output = { slots: Slot[] } | { error: string };

async function handler(input: Input, ctx: ToolContext): Promise<ToolResult<Output>> {
  const result = await checkAvailabilityForClinic(ctx.clinicId, input);

  if ("error" in result) {
    const errorCode =
      result.outcome === "degraded"
        ? result.error.includes("expirado")
          ? "GOOGLE_AUTH_REQUIRED"
          : result.error.includes("no está disponible")
            ? "GOOGLE_CALENDAR_UNAVAILABLE"
            : "GOOGLE_READ_FAILED"
        : "AVAILABILITY_CHECK_FAILED";
    return { success: false, error: result.error, error_code: errorCode };
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
