import { z } from "zod";
import { uuidSchema } from "@/lib/uuid-schema";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const createAppointmentSchema = z.object({
  client_id: uuidSchema,
  pet_id: uuidSchema,
  vet_user_id: uuidSchema,
  service_id: uuidSchema,
  starts_at: z.string().datetime(),
  notes: z.string().optional(),
  conversation_id: uuidSchema.optional(),
  created_by: z.enum(["agent", "admin", "reception"]),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateAppointmentState = {
  success?: boolean;
  appointment_id?: string;
  google_event_id?: string;
  error?: string;
};
