import { z } from "zod";
import { linkConversationIdentity } from "@/lib/agent/conversation-identity";
import { uuidSchema } from "@/lib/uuid-schema";
import type { Tool, ToolContext, ToolResult } from "./types";

// ---------------------------------------------------------------------------
// register_new_pet
// ---------------------------------------------------------------------------

const SPECIES = ["dog", "cat", "rabbit", "ferret", "rodent", "bird", "reptile", "other"] as const;

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
  const { data: client, error: clientError } = await ctx.supabaseAdmin
    .from("clients")
    .select("id")
    .eq("id", input.client_id)
    .eq("clinic_id", ctx.clinicId)
    .is("deleted_at", null)
    .maybeSingle();

  if (clientError || !client) {
    return {
      success: false,
      error: "El cliente no existe o no pertenece a la clínica.",
      error_code: "CLIENT_NOT_FOUND",
    };
  }

  const { data: inserted, error } = await (ctx.supabaseAdmin.from("pets") as any)
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

  const linkResult = await linkConversationIdentity(ctx.supabaseAdmin, {
    conversationId: ctx.conversationId,
    clinicId: ctx.clinicId,
    clientId: input.client_id,
    petId: pet.id,
  });
  if (!linkResult.success) {
    ctx.logger("[register_new_pet] conversation link error", linkResult.error);
  }

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
