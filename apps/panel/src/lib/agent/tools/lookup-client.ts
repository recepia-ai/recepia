import { z } from "zod";
import { linkConversationIdentity } from "@/lib/agent/conversation-identity";
import { findClientByIdentity } from "@/lib/client-identity";
import type { Tool, ToolContext, ToolResult } from "./types";

// ---------------------------------------------------------------------------
// lookup_client
// ---------------------------------------------------------------------------

const inputSchema = z
  .object({
    phone: z.string().trim().optional(),
    document_id: z.string().trim().optional(),
  })
  .refine((input) => input.phone || input.document_id, {
    message: "Indica teléfono o DNI/NIE",
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
  // Phone is authoritative for channel traffic. DNI/NIE is the fallback for
  // an explicitly supplied identity document.
  const client = await findClientByIdentity(ctx.supabaseAdmin, ctx.clinicId, {
    phone: input.phone,
    documentId: input.document_id,
  });

  if (!client) {
    return { success: true, data: { found: false } };
  }

  const c = client;

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

  const activePets = (pets ?? []) as NonNullable<Output["pets"]>;
  const linkResult = await linkConversationIdentity(ctx.supabaseAdmin, {
    conversationId: ctx.conversationId,
    clinicId: ctx.clinicId,
    clientId: c.id,
    // With one pet there is no ambiguity. With several, a later registration
    // or appointment tool will persist the pet explicitly selected by the user.
    petId: activePets.length === 1 ? activePets[0]?.id : undefined,
  });
  if (!linkResult.success) {
    ctx.logger("[lookup_client] conversation link error", linkResult.error);
    return {
      success: false,
      error: "Se encontró el cliente, pero no se pudo asociar a la conversación.",
      error_code: "CONVERSATION_LINK_FAILED",
    };
  }

  return {
    success: true,
    data: {
      found: true,
      client: { id: c.id, name: c.name, phone: c.phone },
      pets: activePets,
    },
  };
}

export const lookupClient: Tool<Input, Output> = {
  name: "lookup_client",
  description:
    "Busca un cliente por teléfono (identificador principal) o por DNI/NIE. Úsalo al inicio de cada conversación para identificar al cliente. Devuelve el cliente y todas sus mascotas si existe.",
  inputSchema,
  handler,
};
