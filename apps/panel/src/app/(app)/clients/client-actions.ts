"use server";

import { z } from "zod";
import { readGestorVetClient } from "@/lib/gestorvet/discovery";
import { gestorVetClientSummary } from "@/lib/gestorvet/native-adapters";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.string().trim().max(150);

export async function searchNativeGestorVetClients(query: string): Promise<{
  clients?: Array<{
    id: string;
    name: string;
    phone: string;
    email: null;
    pet_count: null;
    source: "gestorvet";
  }>;
  error?: string;
}> {
  const parsed = schema.safeParse(query);
  if (!parsed.success) return { error: "La búsqueda no es válida" };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "No autenticado" };
  const { data: membership } = await supabase
    .from("clinic_users")
    .select("clinic_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!membership) return { error: "Sin clínica asignada" };

  try {
    const { client } = await readGestorVetClient(createAdminClient(), membership.clinic_id);
    const numeric = /^\d+$/.test(parsed.data);
    const records = await client.getClients({
      id: numeric ? parsed.data : undefined,
      name: parsed.data && !numeric ? parsed.data : undefined,
      page: 0,
    });
    return {
      clients: records.flatMap((record) => {
        const summary = gestorVetClientSummary(record);
        return summary
          ? [
              {
                id: summary.externalId,
                name: summary.name,
                phone: "",
                email: null,
                pet_count: null,
                source: "gestorvet" as const,
              },
            ]
          : [];
      }),
    };
  } catch {
    return { error: "No se pudo consultar GestorVet" };
  }
}
