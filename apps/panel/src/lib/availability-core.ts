import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken } from "@/lib/google-tokens";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { CheckAvailabilityInput, AvailableSlot, CheckAvailabilityState } from "@/app/(app)/_actions/availability-schemas";
import { checkAvailabilitySchema } from "@/app/(app)/_actions/availability-schemas";

const TIMEZONE = "Europe/Madrid";
const SLOT_GRANULARITY_MIN = 30;
const MAX_SLOTS = 200;

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

type VetRow = { id: string; display_name: string | null };
type VetCalendarRow = { vet_user_id: string; google_calendar_id: string };
type BusyInterval = { start: string; end: string };

function isoMadrid(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function fromMadrid(localStr: string): Date {
  return fromZonedTime(localStr, TIMEZONE);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart);
}

async function getBusyIntervals(
  calendarId: string,
  timeMin: string,
  timeMax: string,
  accessToken: string,
): Promise<BusyInterval[]> {
  try {
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ timeMin, timeMax, items: [{ id: calendarId }] }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("[getBusyIntervals] freeBusy error:", res.status, errText);
      return [];
    }
    const data = await res.json();
    return data.calendars?.[calendarId]?.busy ?? [];
  } catch (err) {
    console.error("[getBusyIntervals] network error:", err);
    return [];
  }
}

function generateSlotsForBlock(
  dateStr: string,
  startTime: string,
  endTime: string,
  durationMinutes: number,
): Array<{ starts_at: string; ends_at: string }> {
  const slots: Array<{ starts_at: string; ends_at: string }> = [];
  const startParts = startTime.split(":").map(Number);
  const endParts = endTime.split(":").map(Number);
  const blockStartMin = (startParts[0] ?? 0) * 60 + (startParts[1] ?? 0);
  const blockEndMin = (endParts[0] ?? 0) * 60 + (endParts[1] ?? 0);
  let currentMin = blockStartMin;
  while (currentMin + durationMinutes <= blockEndMin) {
    const startH = Math.floor(currentMin / 60);
    const startM = currentMin % 60;
    const endH = Math.floor((currentMin + durationMinutes) / 60);
    const endM = (currentMin + durationMinutes) % 60;
    const localStart = `${dateStr}T${pad(startH)}:${pad(startM)}:00`;
    const localEnd = `${dateStr}T${pad(endH)}:${pad(endM)}:00`;
    slots.push({ starts_at: isoMadrid(fromMadrid(localStart)), ends_at: isoMadrid(fromMadrid(localEnd)) });
    currentMin += SLOT_GRANULARITY_MIN;
  }
  return slots;
}

export async function checkAvailabilityForClinic(
  clinicId: string,
  input: CheckAvailabilityInput,
): Promise<CheckAvailabilityState> {
  const parsed = checkAvailabilitySchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Datos inválidos: " + parsed.error.issues.map((i) => i.message).join(", ") };
  }

  const { date_from, date_to, service_id, vet_user_id } = parsed.data;
  const supabaseAdmin = createAdminClient();

  // Load service
  const { data: serviceData, error: serviceError } = await supabaseAdmin
    .from("services")
    .select("id, name, duration_minutes, is_surgery, requires_specific_vet_user_id")
    .eq("id", service_id)
    .eq("clinic_id", clinicId)
    .maybeSingle();

  if (serviceError || !serviceData) {
    return { error: "Servicio no encontrado en esta clínica." };
  }
  const service = serviceData as unknown as ServiceRow;

  // Determine vet candidates
  let candidateVetIds: string[];
  if (service.requires_specific_vet_user_id != null) {
    candidateVetIds = [service.requires_specific_vet_user_id];
  } else if (vet_user_id) {
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
    const { data: assignments } = await supabaseAdmin
      .from("service_vet_assignments")
      .select("vet_user_id")
      .eq("service_id", service_id)
      .eq("clinic_id", clinicId);
    if (assignments && assignments.length > 0) {
      candidateVetIds = (assignments as { vet_user_id: string }[]).map((a) => a.vet_user_id);
    } else {
      const { data: allVets } = await supabaseAdmin
        .from("clinic_users")
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("staff_type", "vet");
      candidateVetIds = (allVets ?? []).map((v) => v.id);
    }
  }

  if (candidateVetIds.length === 0) {
    return { error: "No hay veterinarios disponibles en esta clínica." };
  }

  // Load vet details + hours + calendars
  const [vetsResult, hoursResult, calendarsResult] = await Promise.all([
    supabaseAdmin.from("clinic_users").select("id, display_name").eq("clinic_id", clinicId).in("id", candidateVetIds),
    supabaseAdmin.from("vet_consultation_hours").select("vet_user_id, day_of_week, start_time, end_time").eq("clinic_id", clinicId).in("vet_user_id", candidateVetIds),
    supabaseAdmin.from("vet_calendars").select("vet_user_id, google_calendar_id").eq("clinic_id", clinicId).in("vet_user_id", candidateVetIds),
  ]);

  const vets = (vetsResult.data ?? []) as VetRow[];
  const hours = (hoursResult.data ?? []) as ConsultationHourRow[];
  const calendars = (calendarsResult.data ?? []) as VetCalendarRow[];

  const vetNameById = new Map(vets.map((v) => [v.id, v.display_name ?? "Sin nombre"]));
  const calendarByVetId = new Map(calendars.map((c) => [c.vet_user_id, c.google_calendar_id]));

  // Get Google access token
  const tokenResult = await getValidAccessToken(clinicId);
  if ("error" in tokenResult) {
    if (tokenResult.error === "REAUTH_REQUIRED") {
      return { error: "La conexión con Google Calendar ha expirado. Por favor, reconecta la integración." };
    }
    return { error: "Error al leer los tokens de Google Calendar." };
  }
  const accessToken = tokenResult.access_token;

  // Date range
  const fromDate = new Date(date_from);
  const toDate = new Date(date_to);
  const fromDay = fromMadrid(formatInTimeZone(fromDate, TIMEZONE, "yyyy-MM-dd") + "T00:00:00");
  const toDay = fromMadrid(formatInTimeZone(toDate, TIMEZONE, "yyyy-MM-dd") + "T00:00:00");

  const daysInRange: string[] = [];
  const cursor = new Date(fromDay);
  while (cursor <= toDay) {
    daysInRange.push(formatInTimeZone(cursor, TIMEZONE, "yyyy-MM-dd"));
    cursor.setDate(cursor.getDate() + 1);
  }

  const datesByDayOfWeek = new Map<number, string[]>();
  for (const ds of daysInRange) {
    const dow = fromZonedTime(ds + "T12:00:00", TIMEZONE).getUTCDay();
    if (!datesByDayOfWeek.has(dow)) datesByDayOfWeek.set(dow, []);
    datesByDayOfWeek.get(dow)!.push(ds);
  }

  // For each vet, compute slots
  const allSlots: AvailableSlot[] = [];
  for (const vetId of candidateVetIds) {
    const googleCalendarId = calendarByVetId.get(vetId);
    if (!googleCalendarId) continue;
    const vetHours = hours.filter((h) => h.vet_user_id === vetId);
    if (vetHours.length === 0) continue;
    const vetName = vetNameById.get(vetId) ?? "Sin nombre";

    const candidateSlots: Array<{ starts_at: string; ends_at: string }> = [];
    for (const hourBlock of vetHours) {
      const dates = datesByDayOfWeek.get(hourBlock.day_of_week) ?? [];
      for (const dateStr of dates) {
        candidateSlots.push(...generateSlotsForBlock(dateStr, hourBlock.start_time, hourBlock.end_time, service.duration_minutes));
      }
    }
    if (candidateSlots.length === 0) continue;
    candidateSlots.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

    const timeMin = formatInTimeZone(fromDay, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
    const timeMax = formatInTimeZone(new Date(toDay.getTime() + 24 * 60 * 60 * 1000), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");

    const busyIntervals = await getBusyIntervals(googleCalendarId, timeMin, timeMax, accessToken);
    const available = candidateSlots.filter(
      (slot) => !busyIntervals.some((busy) => overlaps(slot.starts_at, slot.ends_at, busy.start, busy.end)),
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
    if (allSlots.length >= MAX_SLOTS) break;
  }

  allSlots.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  return { slots: allSlots.slice(0, MAX_SLOTS) };
}
