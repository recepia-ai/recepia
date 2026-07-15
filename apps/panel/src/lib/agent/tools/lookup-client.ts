import { z } from "zod";
import type { Tool, ToolResult, ToolContext } from "./types";

// ---------------------------------------------------------------------------
// lookup_client
// ---------------------------------------------------------------------------

const inputSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9][0-9]{6,14}$/, "Formato E.164 (+34 seguido de 9 dígitos)"),
});

type Input = z.infer<typeof inputSchema>;

type Output = {
  found: boolean;
  client?: { id: string; name: string; phone: string };
  pets?: Array<{
    id: string;
    name: string;
    species: string;
    breed: string | null;
  }>;
};

async function handler(input: Input, ctx: ToolContext): Promise<ToolResult<Output>> {
  // 1. Look up client by phone
  const { data: client, error: clientErr } = await (ctx.supabaseAdmin
    .from("clients") as any)
    .select("id, name, phone")
    .eq("clinic_id", ctx.clinicId)
    .eq("phone", input.phone)
    .maybeSingle();

  if (clientErr) {
    ctx.logger("[lookup_client] client query error", clientErr);
    return { success: false, error: "Error al buscar el cliente." };
  }

  if (!client) {
    return { success: true, data: { found: false } };
  }

  const c = client as { id: string; name: string; phone: string };

  // 2. Load associated pets
  const { data: pets, error: petsErr } = await ctx.supabaseAdmin
    .from("pets")
    .select("id, name, species, breed")
    .eq("client_id", c.id)
    .eq("active", true)
    .order("name", { ascending: true });

  if (petsErr) {
    ctx.logger("[lookup_client] pets query error", petsErr);
    return { success: false, error: "Error al cargar las mascotas del cliente." };
  }

  return {
    success: true,
    data: {
      found: true,
      client: { id: c.id, name: c.name, phone: c.phone },
      pets: (pets ?? []) as Output["pets"],
    },
  };
}

export const lookupClient: Tool<Input, Output> = {
  name: "lookup_client",
  description:
    "Busca un cliente en la clínica por su número de teléfono. Úsalo al inicio de cada conversación para identificar al cliente. Devuelve el cliente y todas sus mascotas si existe.",
  inputSchema,
  handler,
};
