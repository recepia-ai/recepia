"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken } from "@/lib/google-tokens";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type {
  CheckAvailabilityInput,
  AvailableSlot,
  CheckAvailabilityState,
} from "./availability-schemas";
import { checkAvailabilitySchema } from "./availability-schemas";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIMEZONE = "Europe/Madrid";
const SLOT_GRANULARITY_MIN = 30;
const MAX_SLOTS = 50;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type ServiceRow = {
  id: string;
  name: string;
  duration_minutes: number;
  is_surgery: boolean;
  requires_specific_vet_user_id: string | null;
};

type ConsultationHourRow = {
  vet_user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type VetRow = {
  id: string;
  display_name: string | null;
};

type VetCalendarRow = {
  vet_user_id: string;
  google_calendar_id: string;
};

type BusyInterval = {
  start: string;
  end: string;
};

type ClinicUserRow = { clinic_id: string; role: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the clinic ID for the authenticated caller (any member, not just admin). */
async function getCallerClinicId(): Promise<string | { error: string }> {
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

  return cu.clinic_id;
}

/** Format a Date as an ISO 8601 string with the Madrid timezone offset. */
function isoMadrid(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/** Convert a Madrid-local datetime string to a UTC Date. */
function fromMadrid(localStr: string): Date {
  return fromZonedTime(localStr, TIMEZONE);
}

/** Pad a number to 2 digits. */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Check if two ISO 8601 intervals overlap. */
function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart);
}

/**
 * Call the Google Calendar freeBusy endpoint for a single calendar.
 * Returns the busy intervals, or an empty array on error (non-fatal for
 * a single vet — we just skip their slots).
 */
async function getBusyIntervals(
  calendarId: string,
  timeMin: string,
  timeMax: string,
  accessToken: string,
): Promise<BusyInterval[]> {
  try {
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/freeBusy",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeMin,
          timeMax,
          items: [{ id: calendarId }],
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(
        "[getBusyIntervals] freeBusy error:",
        res.status,
        errText,
      );
      return [];
    }

    const data = await res.json();
    const busy: BusyInterval[] =
      data.calendars?.[calendarId]?.busy ?? [];
    return busy;
  } catch (err) {
    console.error("[getBusyIntervals] network error:", err);
    return [];
  }
}

/**
 * Generate candidate slots for a single consultation-hour block.
 *
 * A slot is valid if start_time + duration_minutes fits within end_time.
 * Granularity: 30 min.
 */
function generateSlotsForBlock(
  dateStr: string, // "2026-07-01"
  startTime: string, // "08:30:00"
  endTime: string, // "13:30:00"
  durationMinutes: number,
): Array<{ starts_at: string; ends_at: string }> {
  const slots: Array<{ starts_at: string; ends_at: string }> = [];

  const startParts = startTime.split(":").map(Number);
  const endParts = endTime.split(":").map(Number);
  const sh = startParts[0] ?? 0;
  const sm = startParts[1] ?? 0;
  const eh = endParts[0] ?? 0;
  const em = endParts[1] ?? 0;

  const blockStartMin = sh * 60 + sm;
  const blockEndMin = eh * 60 + em;

  let currentMin = blockStartMin;

  while (currentMin + durationMinutes <= blockEndMin) {
    const startH = Math.floor(currentMin / 60);
    const startM = currentMin % 60;
    const endH = Math.floor((currentMin + durationMinutes) / 60);
    const endM = (currentMin + durationMinutes) % 60;

    const localStart = `${dateStr}T${pad(startH)}:${pad(startM)}:00`;
    const localEnd = `${dateStr}T${pad(endH)}:${pad(endM)}:00`;

    slots.push({
      starts_at: isoMadrid(fromMadrid(localStart)),
      ends_at: isoMadrid(fromMadrid(localEnd)),
    });

    currentMin += SLOT_GRANULARITY_MIN;
  }

  return slots;
}

// ---------------------------------------------------------------------------
// checkAvailability — main server action
// ---------------------------------------------------------------------------

/**
 * Example invocation (copy into a test page to try manually):
 *
 * ```ts
 * import { checkAvailability } from "./_actions/availability-actions";
 *
 * const result = await checkAvailability({
 *   date_from: "2026-07-01T00:00:00Z",
 *   date_to: "2026-07-03T23:59:59Z",
 *   service_id: "CONSULTA_SERVICE_UUID",
 * });
 * ```
 */
export async function checkAvailability(
  input: CheckAvailabilityInput,
): Promise<CheckAvailabilityState> {
  // ------------------------------------------------------------------
  // 1. Validate input
  // ------------------------------------------------------------------
  const parsed = checkAvailabilitySchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Datos inválidos: " + parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const { date_from, date_to, service_id, vet_user_id } = parsed.data;

  // ------------------------------------------------------------------
  // 2. Auth — get clinic ID
  // ------------------------------------------------------------------
  const clinicIdOrError = await getCallerClinicId();
  if (typeof clinicIdOrError !== "string") return clinicIdOrError;

  const clinicId = clinicIdOrError;
  const supabaseAdmin = createAdminClient();

  // ------------------------------------------------------------------
  // 3. Load service
  // ------------------------------------------------------------------
  const { data: serviceData, error: serviceError } = await supabaseAdmin
    .from("services")
    .select(
      "id, name, duration_minutes, is_surgery, requires_specific_vet_user_id",
    )
    .eq("id", service_id)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (serviceError || !serviceData) {
    console.error("[checkAvailability] service query error:", serviceError);
    return { error: "Servicio no encontrado en esta clínica." };
  }

  const service = serviceData as unknown as ServiceRow;

  // ------------------------------------------------------------------
  // 4. Determine vet candidates
  // ------------------------------------------------------------------
  let candidateVetIds: string[];

  if (
    service.is_surgery &&
    service.requires_specific_vet_user_id
  ) {
    // Surgery → force the specific vet
    candidateVetIds = [service.requires_specific_vet_user_id];
  } else if (vet_user_id) {
    // Caller specified a vet → use it (validate it belongs to clinic)
    const { data: vetCheck } = await supabaseAdmin
      .from("clinic_users")
      .select("id")
      .eq("id", vet_user_id)
      .eq("clinic_id", clinicId)
      .eq("staff_type", "vet")
      .maybeSingle();

    if (!vetCheck) {
      return { error: "El veterinario especificado no pertenece a esta clínica." };
    }
    candidateVetIds = [vet_user_id];
  } else {
    // No vet specified → all vets in the clinic
    const { data: allVets } = await supabaseAdmin
      .from("clinic_users")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("staff_type", "vet");

    candidateVetIds = (allVets ?? []).map((v) => v.id);
  }

  if (candidateVetIds.length === 0) {
    return { error: "No hay veterinarios disponibles en esta clínica." };
  }

  // ------------------------------------------------------------------
  // 5. Load vet details + consultation hours + calendars in parallel
  // ------------------------------------------------------------------
  const [vetsResult, hoursResult, calendarsResult] = await Promise.all([
    supabaseAdmin
      .from("clinic_users")
      .select("id, display_name")
      .eq("clinic_id", clinicId)
      .in("id", candidateVetIds),
    supabaseAdmin
      .from("vet_consultation_hours")
      .select("vet_user_id, day_of_week, start_time, end_time")
      .eq("clinic_id", clinicId)
      .in("vet_user_id", candidateVetIds),
    supabaseAdmin
      .from("vet_calendars")
      .select("vet_user_id, google_calendar_id")
      .eq("clinic_id", clinicId)
      .in("vet_user_id", candidateVetIds),
  ]);

  const vets = (vetsResult.data ?? []) as VetRow[];
  const hours = (hoursResult.data ?? []) as ConsultationHourRow[];
  const calendars = (calendarsResult.data ?? []) as VetCalendarRow[];

  // Build lookup maps
  const vetNameById = new Map(vets.map((v) => [v.id, v.display_name ?? "Sin nombre"]));
  const calendarByVetId = new Map(
    calendars.map((c) => [c.vet_user_id, c.google_calendar_id]),
  );

  // ------------------------------------------------------------------
  // 6. Get a valid Google access token for freebusy queries
  // ------------------------------------------------------------------
  const tokenResult = await getValidAccessToken(clinicId);
  if ("error" in tokenResult) {
    if (tokenResult.error === "REAUTH_REQUIRED") {
      return {
        error:
          "La conexión con Google Calendar ha expirado. Por favor, reconecta la integración.",
      };
    }
    return { error: "Error al leer los tokens de Google Calendar." };
  }
  const accessToken = tokenResult.access_token;

  // ------------------------------------------------------------------
  // 7. Date range iteration helpers
  // ------------------------------------------------------------------
  const fromDate = new Date(date_from);
  const toDate = new Date(date_to);

  // Normalize to start of day in Madrid timezone
  const fromDay = fromMadrid(
    formatInTimeZone(fromDate, TIMEZONE, "yyyy-MM-dd") + "T00:00:00",
  );
  const toDay = fromMadrid(
    formatInTimeZone(toDate, TIMEZONE, "yyyy-MM-dd") + "T00:00:00",
  );

  // Pre-compute the Madrid-local date strings for each day in the range
  const daysInRange: string[] = [];
  const cursor = new Date(fromDay);
  while (cursor <= toDay) {
    daysInRange.push(formatInTimeZone(cursor, TIMEZONE, "yyyy-MM-dd"));
    cursor.setDate(cursor.getDate() + 1);
  }

  // Build map: day_of_week → date strings
  const datesByDayOfWeek = new Map<number, string[]>();
  for (const ds of daysInRange) {
    const dow = fromZonedTime(ds + "T12:00:00", TIMEZONE).getUTCDay();
    if (!datesByDayOfWeek.has(dow)) datesByDayOfWeek.set(dow, []);
    datesByDayOfWeek.get(dow)!.push(ds);
  }

  // ------------------------------------------------------------------
  // 8. For each vet candidate, compute available slots
  // ------------------------------------------------------------------
  const allSlots: AvailableSlot[] = [];

  for (const vetId of candidateVetIds) {
    const googleCalendarId = calendarByVetId.get(vetId);
    if (!googleCalendarId) continue; // No calendar assigned → skip

    const vetHours = hours.filter((h) => h.vet_user_id === vetId);
    if (vetHours.length === 0) continue; // No consultation hours → skip

    const vetName = vetNameById.get(vetId) ?? "Sin nombre";

    // Generate all candidate slots for this vet
    const candidateSlots: Array<{
      starts_at: string;
      ends_at: string;
    }> = [];

    for (const hourBlock of vetHours) {
      const dates = datesByDayOfWeek.get(hourBlock.day_of_week) ?? [];
      for (const dateStr of dates) {
        candidateSlots.push(
          ...generateSlotsForBlock(
            dateStr,
            hourBlock.start_time,
            hourBlock.end_time,
            service.duration_minutes,
          ),
        );
      }
    }

    if (candidateSlots.length === 0) continue;

    // Sort by starts_at
    candidateSlots.sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );

    // Query freebusy for the full range (one API call per vet)
    const timeMin = formatInTimeZone(
      fromDay,
      TIMEZONE,
      "yyyy-MM-dd'T'HH:mm:ssXXX",
    );
    const timeMax = formatInTimeZone(
      // Add one day to toDay for inclusive end
      new Date(toDay.getTime() + 24 * 60 * 60 * 1000),
      TIMEZONE,
      "yyyy-MM-dd'T'HH:mm:ssXXX",
    );

    const busyIntervals = await getBusyIntervals(
      googleCalendarId,
      timeMin,
      timeMax,
      accessToken,
    );

    // Filter: keep slots that don't overlap any busy interval
    const available = candidateSlots.filter(
      (slot) =>
        !busyIntervals.some((busy) =>
          overlaps(slot.starts_at, slot.ends_at, busy.start, busy.end),
        ),
    );

    for (const slot of available) {
      allSlots.push({
        vet_user_id: vetId,
        vet_name: vetName,
        starts_at: slot.starts_at,
        ends_at: slot.ends_at,
        calendar_id: googleCalendarId,
      });
    }

    // Early exit: respect MAX_SLOTS
    if (allSlots.length >= MAX_SLOTS) break;
  }

  // ------------------------------------------------------------------
  // 9. Sort all slots by starts_at, cap at MAX_SLOTS
  // ------------------------------------------------------------------
  allSlots.sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );

  return { slots: allSlots.slice(0, MAX_SLOTS) };
}
