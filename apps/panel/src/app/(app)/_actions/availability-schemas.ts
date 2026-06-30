import { z } from "zod";
import { uuidSchema } from "@/lib/uuid-schema";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const checkAvailabilitySchema = z.object({
  date_from: z.string().datetime(),
  date_to: z.string().datetime(),
  service_id: uuidSchema,
  vet_user_id: uuidSchema.optional(),
});

export type CheckAvailabilityInput = z.infer<typeof checkAvailabilitySchema>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AvailableSlot = {
  vet_user_id: string;
  vet_name: string;
  starts_at: string;
  ends_at: string;
  calendar_id: string;
};

export type CheckAvailabilityState =
  | { slots: AvailableSlot[] }
  | { error: string };
