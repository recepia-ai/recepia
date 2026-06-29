"use server";

import { createClient } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/google-tokens";
import { revalidatePath } from "next/cache";
import type { GoogleCalendarListItem } from "@/lib/google-calendar-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClinicUserRow = { clinic_id: string; role: string };

export type VetWithCalendar = {
  id: string;
  displayName: string | null;
  specialtyPrimary: string | null;
  specialtySecondary: string[] | null;
  assignedCalendarId: string | null;
  assignedCalendarSummary: string | null;
  /** Exists in vet_calendars if a calendar is assigned. */
  vetCalendarRowId: string | null;
};

export type CalendarDiscoveryState = {
  success?: boolean;
  error?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAdminClinicId(): Promise<string | { error: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinic_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  const cu = clinicUser as ClinicUserRow | null;
  if (!cu) return { error: "Sin clínica asignada" };
  if (cu.role !== "admin")
    return { error: "Solo el administrador puede gestionar integraciones" };

  return cu.clinic_id;
}

// ---------------------------------------------------------------------------
// listGoogleCalendars — returns calendars available in the connected account
// ---------------------------------------------------------------------------

export async function listGoogleCalendars(): Promise<
  { calendars: GoogleCalendarListItem[] } | { error: string }
> {
  const supabase = await createClient();

  const clinicIdOrError = await getAdminClinicId();
  if (typeof clinicIdOrError !== "string") return clinicIdOrError;

  // Get a valid access token (auto-refreshed if needed)
  const tokenResult = await getValidAccessToken(clinicIdOrError);
  if ("error" in tokenResult) {
    if (tokenResult.error === "REAUTH_REQUIRED") {
      return {
        error:
          "La conexión con Google Calendar ha expirado. Por favor, vuelve a conectar la integración.",
      };
    }
    return { error: "Error al leer los tokens de Google Calendar." };
  }

  // Call Google Calendar API
  try {
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      {
        headers: {
          Authorization: `Bearer ${tokenResult.access_token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(
        "[listGoogleCalendars] calendarList API error:",
        res.status,
        errText,
      );
      return {
        error:
          "Error al consultar los calendarios de Google. Verifica los permisos.",
      };
    }

    const data = await res.json();
    const items: GoogleCalendarListItem[] = data.items ?? [];

    // Filter: only calendars the user can write to
    const writable = items.filter(
      (c) => c.accessRole === "owner" || c.accessRole === "writer",
    );

    // Sort: primary first, then alphabetical
    writable.sort((a, b) => {
      if (a.primary && !b.primary) return -1;
      if (!a.primary && b.primary) return 1;
      return a.summary.localeCompare(b.summary);
    });

    return { calendars: writable };
  } catch (err) {
    console.error("[listGoogleCalendars] network error:", err);
    return { error: "Error de red al conectar con Google Calendar." };
  }
}

// ---------------------------------------------------------------------------
// listVetsWithCalendars — returns all vets + their calendar assignments
// ---------------------------------------------------------------------------

export async function listVetsWithCalendars(): Promise<
  { vets: VetWithCalendar[] } | { error: string }
> {
  const supabase = await createClient();

  const clinicIdOrError = await getAdminClinicId();
  if (typeof clinicIdOrError !== "string") return clinicIdOrError;

  const clinicId = clinicIdOrError;

  // Fetch vets and calendar assignments in parallel
  const [vetsResult, calendarsResult] = await Promise.all([
    supabase
      .from("clinic_users")
      .select(
        "id, display_name, specialty_primary, specialty_secondary, staff_type",
      )
      .eq("clinic_id", clinicId)
      .order("display_name", { ascending: true }),
    supabase
      .from("vet_calendars")
      .select("id, vet_user_id, google_calendar_id, calendar_summary")
      .eq("clinic_id", clinicId),
  ]);

  if (vetsResult.error) {
    console.error("[listVetsWithCalendars] vets query error:", vetsResult.error);
    return { error: "Error al cargar los veterinarios." };
  }

  // Filter by staff_type = 'vet' AFTER fetching (eq doesn't filter on
  // custom text fields reliably through the typed client).
  const allUsers = (vetsResult.data ?? []) as Array<{
    id: string;
    display_name: string | null;
    specialty_primary: string | null;
    specialty_secondary: string[] | null;
    staff_type: string | null;
  }>;

  const vets = allUsers.filter((u) => u.staff_type === "vet");

  const calRows = (calendarsResult.data ?? []) as Array<{
    id: string;
    vet_user_id: string;
    google_calendar_id: string;
    calendar_summary: string | null;
  }>;

  // Merge
  const result: VetWithCalendar[] = vets.map((vet) => {
    const cal = calRows.find((c) => c.vet_user_id === vet.id);
    return {
      id: vet.id,
      displayName: vet.display_name ?? null,
      specialtyPrimary: vet.specialty_primary ?? null,
      specialtySecondary: vet.specialty_secondary ?? null,
      assignedCalendarId: cal?.google_calendar_id ?? null,
      assignedCalendarSummary: cal?.calendar_summary ?? null,
      vetCalendarRowId: cal?.id ?? null,
    };
  });

  return { vets: result };
}

// ---------------------------------------------------------------------------
// assignCalendarToVet — set or clear a vet's calendar assignment
// ---------------------------------------------------------------------------

export async function assignCalendarToVet(
  vetUserId: string,
  googleCalendarId: string | null,
  calendarSummary: string | null,
): Promise<CalendarDiscoveryState> {
  const supabase = await createClient();

  const clinicIdOrError = await getAdminClinicId();
  if (typeof clinicIdOrError !== "string") return clinicIdOrError;

  const clinicId = clinicIdOrError;

  // Verify vet belongs to this clinic
  const { data: vetCheck } = await supabase
    .from("clinic_users")
    .select("id, staff_type")
    .eq("id", vetUserId)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  const vetRow = vetCheck as { id: string; staff_type: string | null } | null;
  if (!vetRow || vetRow.staff_type !== "vet") {
    return { error: "Veterinario no encontrado en esta clínica." };
  }

  // --- Unassign: remove from vet_calendars ---
  if (!googleCalendarId) {
    const { data: deleted, error } = await supabase
      .from("vet_calendars")
      .delete()
      .eq("clinic_id", clinicId)
      .eq("vet_user_id", vetUserId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[assignCalendarToVet] delete error:", error);
      return { error: "Error al quitar la asignación." };
    }

    revalidatePath("/settings/integrations");
    return { success: true };
  }

  // --- Assign: UPSERT via delete + insert (UNIQUE constraint) ---
  // Delete any existing row for this vet
  const { error: delError } = await supabase
    .from("vet_calendars")
    .delete()
    .eq("clinic_id", clinicId)
    .eq("vet_user_id", vetUserId);

  if (delError) {
    console.error("[assignCalendarToVet] pre-delete error:", delError);
    return { error: "Error al actualizar la asignación." };
  }

  // Insert new row
  const { data: inserted, error: insertError } = await (supabase
    .from("vet_calendars") as any).insert({
    clinic_id: clinicId,
    vet_user_id: vetUserId,
    google_calendar_id: googleCalendarId,
    calendar_summary: calendarSummary,
    sync_enabled: true,
  }).select("id")
    .maybeSingle();

  if (insertError) {
    console.error("[assignCalendarToVet] insert error:", insertError);
    return { error: "Error al guardar la asignación." };
  }

  if (!inserted) {
    return { error: "No se pudo guardar la asignación." };
  }

  revalidatePath("/settings/integrations");
  return { success: true };
}
