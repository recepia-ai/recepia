"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { normalizeDocumentId, normalizeIdentityPhone } from "@/lib/client-identity";
import { readGestorVetClient } from "@/lib/gestorvet/discovery";
import { gestorVetClientSummary } from "@/lib/gestorvet/native-adapters";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.string().trim().max(150);

export async function searchNativeGestorVetClients(query: string): Promise<{
  clients?: Array<{
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
    pet_count: number | null;
    match_context?: string | null;
    source: "recepia" | "gestorvet";
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

  const normalizedQuery = parsed.data;
  const nativeById = new Map<
    string,
    {
      id: string;
      name: string | null;
      phone: string;
      email: string | null;
      match_context?: string | null;
    }
  >();

  if (normalizedQuery) {
    // Separate filters avoid interpolating user text into PostgREST's `.or()`
    // expression grammar. Results are merged and deduplicated below.
    const nativeResults = await Promise.all([
      supabase
        .from("clients")
        .select("id, name, phone, email")
        .eq("clinic_id", membership.clinic_id)
        .is("deleted_at", null)
        .ilike("name", `%${normalizedQuery}%`)
        .limit(50),
      supabase
        .from("clients")
        .select("id, name, phone, email")
        .eq("clinic_id", membership.clinic_id)
        .is("deleted_at", null)
        .ilike("phone", `%${normalizedQuery}%`)
        .limit(50),
      supabase
        .from("clients")
        .select("id, name, phone, email")
        .eq("clinic_id", membership.clinic_id)
        .is("deleted_at", null)
        .ilike("email", `%${normalizedQuery}%`)
        .limit(50),
      supabase
        .from("clients")
        .select("id, name, phone, email")
        .eq("clinic_id", membership.clinic_id)
        .is("deleted_at", null)
        .ilike("document_id", `%${normalizedQuery}%`)
        .limit(50),
    ]);

    for (const result of nativeResults) {
      if (result.error) return { error: "No se pudo buscar en los clientes de Recepia" };
      for (const client of result.data ?? []) nativeById.set(client.id, client);
    }

    const petResults = await Promise.all([
      supabase
        .from("pets")
        .select("client_id, name")
        .eq("clinic_id", membership.clinic_id)
        .eq("active", true)
        .is("deleted_at", null)
        .ilike("name", `%${normalizedQuery}%`)
        .limit(50),
      supabase
        .from("pets")
        .select("client_id, name")
        .eq("clinic_id", membership.clinic_id)
        .eq("active", true)
        .is("deleted_at", null)
        .ilike("breed", `%${normalizedQuery}%`)
        .limit(50),
      supabase
        .from("pets")
        .select("client_id, name")
        .eq("clinic_id", membership.clinic_id)
        .eq("active", true)
        .is("deleted_at", null)
        .ilike("microchip", `%${normalizedQuery}%`)
        .limit(50),
    ]);
    const petMatches = new Map<string, string>();
    for (const result of petResults) {
      if (result.error) return { error: "No se pudo buscar por mascota" };
      for (const pet of result.data ?? []) {
        if (!petMatches.has(pet.client_id)) petMatches.set(pet.client_id, pet.name);
      }
    }
    const petClientIds = [...petMatches.keys()];
    if (petClientIds.length > 0) {
      const { data: petOwners, error: ownersError } = await supabase
        .from("clients")
        .select("id, name, phone, email")
        .eq("clinic_id", membership.clinic_id)
        .is("deleted_at", null)
        .in("id", petClientIds);
      if (ownersError) return { error: "No se pudieron cargar los propietarios" };
      for (const owner of petOwners ?? []) {
        nativeById.set(owner.id, {
          ...owner,
          match_context: `Mascota: ${petMatches.get(owner.id) ?? "coincidencia"}`,
        });
      }
    }
  }

  const nativeIds = [...nativeById.keys()];
  const petCounts = new Map<string, number>();
  if (nativeIds.length > 0) {
    const { data: pets, error: petsError } = await supabase
      .from("pets")
      .select("id, client_id")
      .eq("clinic_id", membership.clinic_id)
      .eq("active", true)
      .in("client_id", nativeIds);
    if (petsError) return { error: "No se pudieron contar las mascotas" };
    for (const pet of pets ?? []) {
      petCounts.set(pet.client_id, (petCounts.get(pet.client_id) ?? 0) + 1);
    }
  }

  const nativeClients = [...nativeById.values()].map((client) => ({
    ...client,
    pet_count: petCounts.get(client.id) ?? 0,
    source: "recepia" as const,
  }));

  try {
    const { client } = await readGestorVetClient(createAdminClient(), membership.clinic_id);
    const numeric = /^\d+$/.test(parsed.data);
    const records = await client.getClients({
      id: numeric ? parsed.data : undefined,
      name: parsed.data && !numeric ? parsed.data : undefined,
      page: 0,
    });
    const gestorVetClients = records.flatMap((record) => {
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
    });
    return { clients: [...nativeClients, ...gestorVetClients] };
  } catch {
    // Native search remains useful when the optional integration is offline.
    return { clients: nativeClients };
  }
}

const clientUpdateSchema = z.object({
  client_id: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(30),
  email: z.union([z.string().trim().email(), z.literal("")]),
  document_id: z.string().trim().max(30),
  preferred_language: z.enum(["es", "ca", "en", "fr", "it"]),
  notes: z.string().trim().max(2000),
});

const clientCreateSchema = clientUpdateSchema.omit({ client_id: true });

const petSchema = z.object({
  pet_id: z.string().uuid().optional(),
  client_id: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  species: z.enum(["dog", "cat", "rabbit", "ferret", "rodent", "bird", "reptile", "other"]),
  breed: z.string().trim().max(100),
  birth_date: z.union([z.string().date(), z.literal("")]),
  sex: z.enum(["male", "female", "unknown"]),
  microchip: z.string().trim().max(50),
  weight_kg: z.union([z.coerce.number().positive().max(999), z.literal("")]),
  notes: z.string().trim().max(2000),
});

async function editingContext() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "No autenticado" as const };
  const { data: membership } = await supabase
    .from("clinic_users")
    .select("clinic_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!membership) return { error: "Sin clínica asignada" as const };
  return { supabase, clinicId: membership.clinic_id };
}

export async function createClientDetails(formData: FormData): Promise<{
  clientId?: string;
  error?: string;
}> {
  const parsed = clientCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const context = await editingContext();
  if ("error" in context) return { error: context.error };

  const phone = normalizeIdentityPhone(parsed.data.phone);
  if (!phone) return { error: "El teléfono no es válido" };
  const documentId = parsed.data.document_id ? normalizeDocumentId(parsed.data.document_id) : null;
  if (parsed.data.document_id && !documentId) return { error: "El DNI/NIE no es válido" };

  const { data: inserted, error } = await context.supabase
    .from("clients")
    .insert({
      clinic_id: context.clinicId,
      name: parsed.data.name,
      phone,
      email: parsed.data.email || null,
      document_id: documentId,
      preferred_language: parsed.data.preferred_language,
      notes: parsed.data.notes || null,
    })
    .select("id")
    .maybeSingle();

  if (error?.code === "23505")
    return { error: "El teléfono o DNI/NIE ya pertenece a otro cliente" };
  if (error || !inserted) return { error: "No se pudo crear el cliente" };

  revalidatePath("/clients");
  revalidatePath("/calendar");
  revalidatePath("/pets");
  return { clientId: inserted.id };
}

export async function updateClientDetails(formData: FormData): Promise<{
  success?: true;
  error?: string;
}> {
  const parsed = clientUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const context = await editingContext();
  if ("error" in context) return { error: context.error };

  const phone = normalizeIdentityPhone(parsed.data.phone);
  if (!phone) return { error: "El teléfono no es válido" };
  const documentId = parsed.data.document_id ? normalizeDocumentId(parsed.data.document_id) : null;
  if (parsed.data.document_id && !documentId) return { error: "El DNI/NIE no es válido" };

  const { data: updatedClient, error } = await context.supabase
    .from("clients")
    .update({
      name: parsed.data.name,
      phone,
      email: parsed.data.email || null,
      document_id: documentId,
      preferred_language: parsed.data.preferred_language,
      notes: parsed.data.notes || null,
    })
    .eq("id", parsed.data.client_id)
    .eq("clinic_id", context.clinicId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error?.code === "23505")
    return { error: "El teléfono o DNI/NIE ya pertenece a otro cliente" };
  if (error) return { error: "No se pudo actualizar el cliente" };
  if (!updatedClient) return { error: "El cliente no existe" };

  revalidatePath(`/clients/${parsed.data.client_id}`);
  revalidatePath("/clients");
  revalidatePath("/conversations");
  revalidatePath("/pets");
  return { success: true };
}

export async function savePetDetails(formData: FormData): Promise<{
  success?: true;
  error?: string;
}> {
  const parsed = petSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const context = await editingContext();
  if ("error" in context) return { error: context.error };

  const { data: owner } = await context.supabase
    .from("clients")
    .select("id")
    .eq("id", parsed.data.client_id)
    .eq("clinic_id", context.clinicId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!owner) return { error: "El cliente no existe" };

  const payload = {
    clinic_id: context.clinicId,
    client_id: parsed.data.client_id,
    name: parsed.data.name,
    species: parsed.data.species,
    breed: parsed.data.breed || null,
    birth_date: parsed.data.birth_date || null,
    sex: parsed.data.sex,
    microchip: parsed.data.microchip || null,
    weight_kg: parsed.data.weight_kg === "" ? null : parsed.data.weight_kg,
    notes: parsed.data.notes || null,
    active: true,
  };

  if (parsed.data.pet_id) {
    const { data: updatedPet, error } = await context.supabase
      .from("pets")
      .update(payload)
      .eq("id", parsed.data.pet_id)
      .eq("client_id", parsed.data.client_id)
      .eq("clinic_id", context.clinicId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) return { error: "No se pudo guardar la mascota" };
    if (!updatedPet) return { error: "La mascota no existe" };
  } else {
    const { error } = await context.supabase.from("pets").insert(payload);
    if (error) return { error: "No se pudo guardar la mascota" };
  }

  revalidatePath(`/clients/${parsed.data.client_id}`);
  revalidatePath("/clients");
  revalidatePath("/conversations");
  revalidatePath("/pets");
  if (parsed.data.pet_id) revalidatePath(`/pets/${parsed.data.pet_id}`);
  return { success: true };
}
