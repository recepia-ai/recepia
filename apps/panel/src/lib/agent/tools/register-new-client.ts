import { z } from "zod";
import { linkConversationIdentity } from "@/lib/agent/conversation-identity";
import { normalizeDocumentId, normalizeIdentityPhone } from "@/lib/client-identity";
import type { Tool, ToolContext, ToolResult } from "./types";

// ---------------------------------------------------------------------------
// register_new_client
// ---------------------------------------------------------------------------

const inputSchema = z.object({
  name: z.string().trim().min(2, "Mínimo 2 caracteres").max(100),
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9][0-9]{6,14}$/, "Formato E.164 (+34 seguido de 9 dígitos)"),
  email: z.string().trim().email().optional(),
  document_id: z.string().trim().optional(),
});

type Input = z.infer<typeof inputSchema>;

type Output = {
  client_id: string;
  name: string;
  phone: string;
};

async function handler(input: Input, ctx: ToolContext): Promise<ToolResult<Output>> {
  const phone = normalizeIdentityPhone(input.phone);
  const documentId = input.document_id ? normalizeDocumentId(input.document_id) : null;
  if (!phone) return { success: false, error: "El teléfono no es válido." };
  if (input.document_id && !documentId) {
    return { success: false, error: "El DNI/NIE no es válido." };
  }

  const { data: inserted, error } = await (ctx.supabaseAdmin.from("clients") as any)
    .insert({
      clinic_id: ctx.clinicId,
      name: input.name,
      phone,
      email: input.email || null,
      document_id: documentId,
      preferred_language: "es",
    })
    .select("id")
    .maybeSingle();

  if (error) {
    ctx.logger("[register_new_client] insert error", error);

    if (error.code === "23505") {
      return {
        success: false,
        error: "Ya existe un cliente con ese teléfono. Usa lookup_client para encontrarlo.",
        error_code: "DUPLICATE_PHONE",
      };
    }

    return { success: false, error: "Error al registrar el cliente." };
  }

  if (!inserted) {
    return { success: false, error: "No se pudo registrar el cliente." };
  }

  const c = inserted as { id: string };

  const linkResult = await linkConversationIdentity(ctx.supabaseAdmin, {
    conversationId: ctx.conversationId,
    clinicId: ctx.clinicId,
    clientId: c.id,
  });
  if (!linkResult.success) {
    ctx.logger("[register_new_client] conversation link error", linkResult.error);
  }

  return {
    success: true,
    data: { client_id: c.id, name: input.name, phone },
  };
}

export const registerNewClient: Tool<Input, Output> = {
  name: "register_new_client",
  description:
    "Registra un cliente nuevo en la clínica. Úsalo SOLO tras confirmar explícitamente con el cliente que quiere darse de alta. Requiere nombre y teléfono; email y DNI/NIE son opcionales.",
  inputSchema,
  handler,
};
