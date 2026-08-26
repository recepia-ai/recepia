"use server";

import { z } from "zod";
import type { GestorVetRecord } from "@/lib/gestorvet/client";
import { readGestorVetClient } from "@/lib/gestorvet/discovery";
import { gestorVetLookup, gestorVetResolvedValue } from "@/lib/gestorvet/native-adapters";
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
    let records: GestorVetRecord[];
    if (parsed.data.resource === "clients") {
      const [details, populationRows, provinceRows, groupRows, languageRows] = await Promise.all([
        client.getClient(parsed.data.id),
        client.getPopulations(),
        client.getProvinces(),
        client.getClientGroups(),
        client.getMessageLanguages(),
      ]);
      const populations = gestorVetLookup(populationRows);
      const provinces = gestorVetLookup(provinceRows);
      const groups = gestorVetLookup(groupRows);
      const languages = gestorVetLookup(languageRows);
      records = details.map((record) => ({
        ...record,
        POBLACION_NOMBRE: gestorVetResolvedValue(record, populations, "POBLACION").label,
        PROVINCIA_NOMBRE: gestorVetResolvedValue(record, provinces, "PROVINCIA").label,
        GRUPO_NOMBRE: gestorVetResolvedValue(record, groups, "GRUPO", "TIPO_CLIENTE_ID").label,
        IDIOMA_NOMBRE: gestorVetResolvedValue(record, languages, "IDIOMA").label,
      }));
    } else {
      const [details, speciesRows, breedRows, statusRows, sexRows, userRows] = await Promise.all([
        client.getPet(parsed.data.id),
        client.getSpecies(),
        client.getBreeds(),
        client.getPetStatuses(),
        client.getPetSexes(),
        client.getUsers(),
      ]);
      const species = gestorVetLookup(speciesRows);
      const breeds = gestorVetLookup(breedRows);
      const statuses = gestorVetLookup(statusRows);
      const sexes = gestorVetLookup(sexRows);
      const users = gestorVetLookup(userRows);
      records = details.map((record) => ({
        ...record,
        ESPECIE_NOMBRE: gestorVetResolvedValue(record, species, "ESPECIE").label,
        RAZA_NOMBRE: gestorVetResolvedValue(record, breeds, "RAZA").label,
        ESTADO_NOMBRE: gestorVetResolvedValue(record, statuses, "ESTADO").label,
        SEXO_NOMBRE: gestorVetResolvedValue(record, sexes, "SEXO").label,
        VETERINARIO_NOMBRE: gestorVetResolvedValue(
          record,
          users,
          "VETERINARIO",
          "VETERINARIO_HABITUAL",
        ).label,
      }));
    }
    return { records };
  } catch {
    return { error: "No se pudo consultar el detalle en GestorVet" };
  }
}
