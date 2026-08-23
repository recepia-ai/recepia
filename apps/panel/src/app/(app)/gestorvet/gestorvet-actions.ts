"use server";

import { z } from "zod";
import type { GestorVetRecord } from "@/lib/gestorvet/client";
import { readGestorVetClient } from "@/lib/gestorvet/discovery";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const searchSchema = z.object({
  resource: z.enum(["clients", "pets"]),
  query: z.string().trim().max(150),
  page: z.number().int().min(0).max(1_000).default(0),
});

const detailSchema = z.object({
  resource: z.enum(["clients", "pets"]),
  id: z.string().trim().regex(/^\d+$/).max(30),
});

async function liveClient() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("No autenticado");
  const { data: membership } = await supabase
    .from("clinic_users")
    .select("clinic_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!membership) throw new Error("Sin clínica asignada");
  return (await readGestorVetClient(createAdminClient(), membership.clinic_id)).client;
}

export async function searchGestorVetRecords(input: {
  resource: "clients" | "pets";
  query: string;
  page: number;
}): Promise<{ records?: GestorVetRecord[]; error?: string }> {
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { error: "Criterios de búsqueda no válidos" };
  if (parsed.data.resource === "pets" && !parsed.data.query) {
    return { error: "Escribe un nombre o ID para buscar mascotas" };
  }

  try {
    const client = await liveClient();
    const numeric = /^\d+$/.test(parsed.data.query);
    const records =
      parsed.data.resource === "clients"
        ? await client.getClients({
            id: numeric ? parsed.data.query : undefined,
            name: parsed.data.query && !numeric ? parsed.data.query : undefined,
            page: parsed.data.page,
          })
        : await client.getPets({
            id: numeric ? parsed.data.query : undefined,
            name: !numeric ? parsed.data.query : undefined,
          });
    return { records };
  } catch {
    return { error: "No se pudo consultar GestorVet" };
  }
}

export async function getGestorVetRecordDetails(input: {
  resource: "clients" | "pets";
  id: string;
}): Promise<{ records?: GestorVetRecord[]; error?: string }> {
  const parsed = detailSchema.safeParse(input);
  if (!parsed.success) return { error: "Identificador no válido" };

  try {
    const client = await liveClient();
    const records =
      parsed.data.resource === "clients"
        ? await client.getClient(parsed.data.id)
        : await client.getPet(parsed.data.id);
    return { records };
  } catch {
    return { error: "No se pudo consultar el detalle en GestorVet" };
  }
}
