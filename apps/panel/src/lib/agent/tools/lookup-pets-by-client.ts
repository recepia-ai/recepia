import { z } from "zod";
import { uuidSchema } from "@/lib/uuid-schema";
import type { Tool, ToolResult, ToolContext } from "./types";

// ---------------------------------------------------------------------------
// lookup_pets_by_client
// ---------------------------------------------------------------------------

const inputSchema = z.object({
  client_id: uuidSchema,
});

type Input = z.infer<typeof inputSchema>;

type Output = {
  pets: Array<{
    id: string;
    name: string;
    species: string;
    breed: string | null;
  }>;
};

async function handler(input: Input, ctx: ToolContext): Promise<ToolResult<Output>> {
  const { data: pets, error } = await ctx.supabaseAdmin
    .from("pets")
    .select("id, name, species, breed")
    .eq("client_id", input.client_id)
    .eq("clinic_id", ctx.clinicId)
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    ctx.logger("[lookup_pets_by_client] query error", error);
    return { success: false, error: "Error al listar las mascotas." };
  }

  return {
    success: true,
    data: {
      pets: ((pets ?? []) as Output["pets"]),
    },
  };
}

export const lookupPetsByClient: Tool<Input, Output> = {
  name: "lookup_pets_by_client",
  description:
    "Lista las mascotas de un cliente identificado. Devuelve array de mascotas con nombre, especie y raza.",
  inputSchema,
  handler,
};
