import { z } from "zod";
import { uuidSchema } from "@/lib/uuid-schema";
import { createAppointment } from "@/app/(app)/_actions/appointment-actions";
import type { Tool, ToolResult, ToolContext } from "./types";

// ---------------------------------------------------------------------------
// create_appointment
// ---------------------------------------------------------------------------

const inputSchema = z.object({
  client_id: uuidSchema,
  pet_id: uuidSchema,
  vet_user_id: uuidSchema,
  service_id: uuidSchema,
  starts_at: z.string().datetime(),
  notes: z.string().optional(),
});

type Input = z.infer<typeof inputSchema>;

type Output = {
  appointment_id: string;
  google_event_id: string;
};

async function handler(input: Input, ctx: ToolContext): Promise<ToolResult<Output>> {
  // Prepend [AGENT] to notes for traceability
  const notes = input.notes
    ? `[AGENT] ${input.notes}`
    : "[AGENT] cita creada por el agente";

  // createAppointment does its own auth via getCallerClinicId()
  const result = await createAppointment({
    ...input,
    notes,
    created_by: "agent",
    conversation_id: ctx.conversationId ?? undefined,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? "Error desconocido al crear la cita.",
      error_code:
        result.error === "SLOT_NO_LONGER_AVAILABLE"
          ? "SLOT_NO_LONGER_AVAILABLE"
          : undefined,
    };
  }

  return {
    success: true,
    data: {
      appointment_id: result.appointment_id!,
      google_event_id: result.google_event_id!,
    },
  };
}

export const createAppointmentTool: Tool<Input, Output> = {
  name: "create_appointment",
  description:
    "Crea una cita confirmada. INVOCAR SOLO tras confirmar con el cliente día, hora, servicio y mascota. Requiere client_id, pet_id, vet_user_id, service_id, starts_at.",
  inputSchema,
  handler,
};
