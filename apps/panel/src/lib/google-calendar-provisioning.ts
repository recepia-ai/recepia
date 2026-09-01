import { getValidAccessToken } from "@/lib/google-tokens";
import { createAdminClient } from "@/lib/supabase/admin";

const GOOGLE_CALENDARS_URL = "https://www.googleapis.com/calendar/v3/calendars";
const TIME_ZONE = "Europe/Madrid";

type VetCalendarProvisionResult =
  | { success: true; calendarId: string; summary: string }
  | { success: false; error: string };

type ProvisionBatchResult = {
  created: number;
  failed: number;
};

type CalendarInsertResponse = {
  id?: string;
  summary?: string;
  error?: { message?: string };
};

function calendarSummary(displayName: string | null): string {
  return `Recepia · ${displayName?.trim() || "Veterinario"}`;
}

async function createSecondaryCalendar(
  accessToken: string,
  summary: string,
): Promise<{ calendarId: string; summary: string } | { error: string }> {
  const response = await fetch(GOOGLE_CALENDARS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary,
      description: "Agenda clínica creada y gestionada automáticamente por Recepia.",
      timeZone: TIME_ZONE,
    }),
  });

  const payload = (await response.json()) as CalendarInsertResponse;
  if (!response.ok || !payload.id) {
    console.error("[google-calendar-provisioning] calendar insert failed", {
      status: response.status,
      message: payload.error?.message,
    });
    return { error: "No se pudo crear el calendario del veterinario en Google." } as const;
  }

  return { calendarId: payload.id, summary: payload.summary ?? summary } as const;
}

async function deleteSecondaryCalendar(accessToken: string, calendarId: string) {
  try {
    await fetch(`${GOOGLE_CALENDARS_URL}/${encodeURIComponent(calendarId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (error) {
    console.error("[google-calendar-provisioning] orphan calendar cleanup failed", error);
  }
}

export async function ensureDedicatedVetCalendar(
  clinicId: string,
  vetUserId: string,
  displayName: string | null,
): Promise<VetCalendarProvisionResult> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("vet_calendars")
    .select("google_calendar_id, calendar_summary")
    .eq("clinic_id", clinicId)
    .eq("vet_user_id", vetUserId)
    .maybeSingle();

  if (existing?.google_calendar_id) {
    return {
      success: true,
      calendarId: existing.google_calendar_id,
      summary: existing.calendar_summary ?? calendarSummary(displayName),
    };
  }

  const tokenResult = await getValidAccessToken(clinicId);
  if ("error" in tokenResult) {
    return { success: false, error: "Google Calendar no está conectado o requiere autorización." };
  }

  return createAndAssignCalendar(clinicId, vetUserId, displayName, tokenResult.access_token);
}

async function createAndAssignCalendar(
  clinicId: string,
  vetUserId: string,
  displayName: string | null,
  accessToken: string,
): Promise<VetCalendarProvisionResult> {
  const admin = createAdminClient();
  const created = await createSecondaryCalendar(accessToken, calendarSummary(displayName));
  if ("error" in created) return { success: false, error: created.error };

  const { error } = await (admin.from("vet_calendars") as any).upsert(
    {
      clinic_id: clinicId,
      vet_user_id: vetUserId,
      google_calendar_id: created.calendarId,
      calendar_summary: created.summary,
      sync_enabled: true,
    },
    { onConflict: "clinic_id,vet_user_id" },
  );

  if (error) {
    console.error("[google-calendar-provisioning] assignment failed", error);
    await deleteSecondaryCalendar(accessToken, created.calendarId);
    return {
      success: false,
      error: "Se creó el calendario, pero no pudo asignarse al veterinario.",
    };
  }

  return { success: true, calendarId: created.calendarId, summary: created.summary };
}

export async function replaceSharedVetCalendars(
  clinicId: string,
  accessToken: string,
): Promise<ProvisionBatchResult> {
  const admin = createAdminClient();
  const [{ data: vets }, { data: assignments }] = await Promise.all([
    admin
      .from("clinic_users")
      .select("id, display_name")
      .eq("clinic_id", clinicId)
      .eq("staff_type", "vet"),
    admin.from("vet_calendars").select("vet_user_id, google_calendar_id").eq("clinic_id", clinicId),
  ]);

  const calendarUseCount = new Map<string, number>();
  for (const assignment of assignments ?? []) {
    calendarUseCount.set(
      assignment.google_calendar_id,
      (calendarUseCount.get(assignment.google_calendar_id) ?? 0) + 1,
    );
  }

  const vetById = new Map((vets ?? []).map((vet) => [vet.id, vet]));
  const sharedAssignments = (assignments ?? []).filter(
    (assignment) => (calendarUseCount.get(assignment.google_calendar_id) ?? 0) > 1,
  );

  const results = await Promise.all(
    sharedAssignments.map((assignment) => {
      const vet = vetById.get(assignment.vet_user_id);
      if (!vet)
        return Promise.resolve({ success: false as const, error: "Veterinario no encontrado." });
      return createAndAssignCalendar(clinicId, vet.id, vet.display_name, accessToken);
    }),
  );

  return {
    created: results.filter((result) => result.success).length,
    failed: results.filter((result) => !result.success).length,
  };
}
