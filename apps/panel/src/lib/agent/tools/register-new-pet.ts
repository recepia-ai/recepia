import { z } from "zod";
import { uuidSchema } from "@/lib/uuid-schema";
import type { Tool, ToolResult, ToolContext } from "./types";

// ---------------------------------------------------------------------------
// register_new_pet
// ---------------------------------------------------------------------------

const SPECIES = [
  "dog",
  "cat",
  "rabbit",
  "ferret",
  "rodent",
  "bird",
  "reptile",
  "other",
] as const;

const inputSchema = z.object({
  client_id: uuidSchema,
  name: z.string().trim().min(1, "El nombre es obligatorio").max(100),
  species: z.enum(SPECIES),
  breed: z.string().trim().max(100).optional(),
});

type Input = z.infer<typeof inputSchema>;

type Output = {
  pet_id: string;
  name: string;
  species: string;
};

async function handler(input: Input, ctx: ToolContext): Promise<ToolResult<Output>> {
  const { data: inserted, error } = await (ctx.supabaseAdmin
    .from("pets") as any)
    .insert({
      clinic_id: ctx.clinicId,
      client_id: input.client_id,
      name: input.name,
      species: input.species,
      breed: input.breed || null,
      active: true,
    })
    .select("id")
    .maybeSingle();

  if (error || !inserted) {
    ctx.logger("[register_new_pet] insert error", error);
    return { success: false, error: "Error al registrar la mascota." };
  }

  const pet = inserted as { id: string };

  return {
    success: true,
    data: {
      pet_id: pet.id,
      name: input.name,
      species: input.species,
    },
  };
}

export const registerNewPet: Tool<Input, Output> = {
  name: "register_new_pet",
  description:
    "Registra una mascota nueva asociada a un cliente. Requiere el client_id (obtenido de lookup_client o register_new_client), nombre de la mascota y especie.",
  inputSchema,
  handler,
};
