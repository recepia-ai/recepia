"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createAppointment } from "@/app/(app)/_actions/appointment-actions";
import { getAdminClinicId } from "../_actions/test-helpers";

// ---------------------------------------------------------------------------
// Hardcoded test data
// ---------------------------------------------------------------------------

const CLIENT_PHONE = "+34600000200";
const CLIENT_NAME = "Marc TestDirect";
const PET_NAME = "Firulais";
const PET_SPECIES = "dog";
const SERVICE_ID = "8e683cf8-2ca2-4687-8c6f-c05b495eba18";
const VET_USER_ID = "00000000-0000-0000-0000-000000000011";
const STARTS_AT = "2026-07-08T14:30:00Z";

// ---------------------------------------------------------------------------
// Direct test action
// ---------------------------------------------------------------------------

export type DirectTestLog = {
  admin_guard?: { clinic_id: string };
  client?: { action: string; id: string; name: string };
  pet?: { action: string; id: string; name: string };
  appointment?: Record<string, unknown>;
  error?: string;
  error_step?: string;
};

export async function runDirectTest(): Promise<DirectTestLog> {
  const log: DirectTestLog = {};

  // ------------------------------------------------------------------
  // 1. Admin guard
  // ------------------------------------------------------------------
  const clinicIdOrError = await getAdminClinicId();
  if (typeof clinicIdOrError !== "string") {
    return { error: clinicIdOrError.error, error_step: "admin_guard" };
  }

  const clinicId = clinicIdOrError;
  log.admin_guard = { clinic_id: clinicId };

  const supabaseAdmin = createAdminClient();

  // ------------------------------------------------------------------
  // 2. Upsert client (by phone)
  // ------------------------------------------------------------------
  const { data: existingClient } = await (supabaseAdmin
    .from("clients") as any)
    .select("id, name")
    .eq("clinic_id", clinicId)
    .eq("phone", CLIENT_PHONE)
    .maybeSingle();

  let clientId: string;

  if (existingClient) {
    clientId = (existingClient as { id: string; name: string }).id;
    log.client = {
      action: "reused",
      id: clientId,
      name: (existingClient as { id: string; name: string }).name,
    };
  } else {
    const { data: inserted, error: insertErr } = await (supabaseAdmin
      .from("clients") as any)
      .insert({
        clinic_id: clinicId,
        phone: CLIENT_PHONE,
        name: CLIENT_NAME,
        preferred_language: "es",
      })
      .select("id")
      .maybeSingle();

    if (insertErr || !inserted) {
      return {
        error: insertErr?.message ?? "No se pudo crear el cliente.",
        error_step: "create_client",
      };
    }

    clientId = (inserted as { id: string }).id;
    log.client = { action: "created", id: clientId, name: CLIENT_NAME };
  }

  // ------------------------------------------------------------------
  // 3. Upsert pet (by name + client_id)
  // ------------------------------------------------------------------
  const { data: existingPet } = await (supabaseAdmin
    .from("pets") as any)
    .select("id, name")
    .eq("client_id", clientId)
    .eq("name", PET_NAME)
    .maybeSingle();

  let petId: string;

  if (existingPet) {
    petId = (existingPet as { id: string; name: string }).id;
    log.pet = {
      action: "reused",
      id: petId,
      name: (existingPet as { id: string; name: string }).name,
    };
  } else {
    const { data: inserted, error: insertErr } = await (supabaseAdmin
      .from("pets") as any)
      .insert({
        clinic_id: clinicId,
        client_id: clientId,
        name: PET_NAME,
        species: PET_SPECIES,
        active: true,
      })
      .select("id")
      .maybeSingle();

    if (insertErr || !inserted) {
      return {
        error: insertErr?.message ?? "No se pudo crear la mascota.",
        error_step: "create_pet",
      };
    }

    petId = (inserted as { id: string }).id;
    log.pet = { action: "created", id: petId, name: PET_NAME };
  }

  // ------------------------------------------------------------------
  // 4. Call createAppointment directly
  // ------------------------------------------------------------------
  const apptResult = await createAppointment({
    client_id: clientId,
    pet_id: petId,
    vet_user_id: VET_USER_ID,
    service_id: SERVICE_ID,
    starts_at: STARTS_AT,
    notes: "[TEST] cita de prueba directa desde /settings/test-availability/direct",
    created_by: "admin",
  });

  log.appointment = { ...apptResult };

  return log;
}
