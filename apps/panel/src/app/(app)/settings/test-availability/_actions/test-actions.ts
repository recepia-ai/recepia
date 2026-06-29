"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAvailability } from "@/app/(app)/_actions/availability-actions";
import { createAppointment } from "@/app/(app)/_actions/appointment-actions";
import { getAdminClinicId } from "./test-helpers";

// ---------------------------------------------------------------------------
// Client-called server actions (async functions only — no type exports)
// ---------------------------------------------------------------------------

export async function searchClients(query: string) {
  const clinicIdOrError = await getAdminClinicId();
  if (typeof clinicIdOrError !== "string") return clinicIdOrError;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clients")
    .select("id, name, phone")
    .eq("clinic_id", clinicIdOrError)
    .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
    .order("name", { ascending: true })
    .limit(20);

  if (error) {
    console.error("[searchClients] error:", error);
    return { error: "Error al buscar clientes." };
  }

  return { clients: (data ?? []) as { id: string; name: string; phone: string }[] };
}

export async function loadPets(clientId: string) {
  const clinicIdOrError = await getAdminClinicId();
  if (typeof clinicIdOrError !== "string") return clinicIdOrError;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pets")
    .select("id, name, species")
    .eq("client_id", clientId)
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("[loadPets] error:", error);
    return { error: "Error al cargar mascotas." };
  }

  return { pets: (data ?? []) as { id: string; name: string; species: string }[] };
}

export async function createClientAction(input: {
  phone: string;
  name: string;
}) {
  const clinicIdOrError = await getAdminClinicId();
  if (typeof clinicIdOrError !== "string") return clinicIdOrError;

  const supabaseAdmin = createAdminClient();

  const { data: inserted, error } = await (supabaseAdmin
    .from("clients") as any)
    .insert({
      clinic_id: clinicIdOrError,
      phone: input.phone,
      name: input.name,
      preferred_language: "es",
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[createClientAction] error:", error);
    if (error.code === "23505") {
      return { error: "Ya existe un cliente con ese teléfono en esta clínica." };
    }
    return { error: "Error al crear el cliente." };
  }

  if (!inserted) {
    return { error: "No se pudo crear el cliente." };
  }

  return { client_id: (inserted as { id: string }).id };
}

export async function createPetAction(input: {
  client_id: string;
  name: string;
  species: string;
  breed?: string;
}) {
  const clinicIdOrError = await getAdminClinicId();
  if (typeof clinicIdOrError !== "string") return clinicIdOrError;

  const supabaseAdmin = createAdminClient();

  const { data: inserted, error } = await (supabaseAdmin
    .from("pets") as any)
    .insert({
      clinic_id: clinicIdOrError,
      client_id: input.client_id,
      name: input.name,
      species: input.species,
      breed: input.breed || null,
      active: true,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[createPetAction] error:", error);
    return { error: "Error al crear la mascota." };
  }

  if (!inserted) {
    return { error: "No se pudo crear la mascota." };
  }

  return { pet_id: (inserted as { id: string }).id };
}

export async function checkAvailabilityWrapper(input: {
  service_id: string;
  date_from: string;
  date_to: string;
  vet_user_id?: string;
}) {
  // Admin guard
  const clinicIdOrError = await getAdminClinicId();
  if (typeof clinicIdOrError !== "string") return clinicIdOrError;

  return checkAvailability(input);
}

export async function createAppointmentWrapper(input: {
  client_id: string;
  pet_id: string;
  vet_user_id: string;
  service_id: string;
  starts_at: string;
  notes?: string;
  conversation_id?: string;
  created_by: "agent" | "admin" | "reception";
}) {
  // Admin guard
  const clinicIdOrError = await getAdminClinicId();
  if (typeof clinicIdOrError !== "string") return clinicIdOrError;

  // Prepend [TEST] to notes
  const testInput = {
    ...input,
    notes: input.notes
      ? `[TEST] ${input.notes}`
      : "[TEST] cita de prueba desde panel admin",
  };

  return createAppointment(testInput);
}
