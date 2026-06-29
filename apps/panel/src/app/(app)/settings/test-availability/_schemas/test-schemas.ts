import { z } from "zod";
import { uuidSchema } from "@/lib/uuid-schema";

// ---------------------------------------------------------------------------
// Schemas for the test-availability page (NO "use server" — Zod only)
// ---------------------------------------------------------------------------

export const searchFormSchema = z.object({
  service_id: uuidSchema,
  date_from: z.string().datetime(),
  date_to: z.string().datetime(),
  vet_user_id: uuidSchema.optional().or(z.literal("")),
});

export type SearchFormValues = z.infer<typeof searchFormSchema>;

export const createClientSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+34[0-9]{9}$/, "Formato: +34 seguido de 9 dígitos"),
  name: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(100, "Máximo 100 caracteres"),
});

export type CreateClientValues = z.infer<typeof createClientSchema>;

export const createPetSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(100, "Máximo 100 caracteres"),
  species: z.enum(["dog", "cat"]),
  breed: z.string().trim().max(100).optional().or(z.literal("")),
});

export type CreatePetValues = z.infer<typeof createPetSchema>;

// ---------------------------------------------------------------------------
// Shared types (no "use server")
// ---------------------------------------------------------------------------

export type ServiceOption = {
  id: string;
  name: string;
  duration_minutes: number;
  is_surgery: boolean;
};

export type VetOption = {
  id: string;
  display_name: string | null;
};

export type ClientOption = {
  id: string;
  name: string;
  phone: string;
};

export type PetOption = {
  id: string;
  name: string;
  species: string;
};
