import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken } from "@/lib/google-tokens";
import type { CreateAppointmentInput, CreateAppointmentState } from "@/app/(app)/_actions/appointment-schemas";
import { createAppointmentSchema } from "@/app/(app)/_actions/appointment-schemas";

type ServiceRow = {
  id: string;
  name: string;
  duration_minutes: number;
  is_surgery: boolean;
  requires_specific_vet_user_id: string | null;
};

type ClientRow = { id: string; name: string };
type PetRow = { id: string; name: string };
type VetRow = { id: string; display_name: string | null };
type VetCalendarRow = { vet_user_id: string; google_calendar_id: string };

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart);
}

async function isSlotFree(
  calendarId: string,
  startsAt: string,
  endsAt: string,
  accessToken: string,
): Promise<boolean> {
  try {
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ timeMin: startsAt, timeMax: endsAt, items: [{ id: calendarId }] }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("[isSlotFree] freeBusy error:", res.status, errText);
      return false;
    }
    const data = await res.json();
    const busy: Array<{ start: string; end: string }> = data.calendars?.[calendarId]?.busy ?? [];
    return !busy.some((b) => overlaps(startsAt, endsAt, b.start, b.end));
  } catch (err) {
    console.error("[isSlotFree] network error:", err);
    return false;
  }
}

export async function createAppointmentForClinic(
  clinicId: string,
  input: CreateAppointmentInput,
): Promise<CreateAppointmentState> {
  const parsed = createAppointmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Datos inválidos: " + parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { client_id, pet_id, vet_user_id, service_id, starts_at, notes, conversation_id, created_by } = parsed.data;
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

  if (service.is_surgery && service.requires_specific_vet_user_id && vet_user_id !== service.requires_specific_vet_user_id) {
    return { error: "Las cirugías deben asignarse al veterinario designado." };
  }

  const durationMs = service.duration_minutes * 60 * 1000;
  const startsAtDate = new Date(starts_at);
  const ends_at = new Date(startsAtDate.getTime() + durationMs).toISOString();

  // Validate client, pet, vet, calendar
  const [clientResult, petResult, vetResult, calendarResult] = await Promise.all([
    supabaseAdmin.from("clients").select("id, name").eq("id", client_id).eq("clinic_id", clinicId).maybeSingle(),
    supabaseAdmin.from("pets").select("id, name").eq("id", pet_id).eq("client_id", client_id).maybeSingle(),
    supabaseAdmin.from("clinic_users").select("id, display_name").eq("id", vet_user_id).eq("clinic_id", clinicId).eq("staff_type", "vet").maybeSingle(),
    supabaseAdmin.from("vet_calendars").select("vet_user_id, google_calendar_id").eq("vet_user_id", vet_user_id).eq("clinic_id", clinicId).maybeSingle(),
  ]);

  const client = clientResult.data as ClientRow | null;
  if (!client) return { error: "Cliente no encontrado en esta clínica." };
  const pet = petResult.data as PetRow | null;
  if (!pet) return { error: "Mascota no encontrada para este cliente." };
  const vet = vetResult.data as VetRow | null;
  if (!vet) return { error: "Veterinario no encontrado en esta clínica." };
  const calendar = calendarResult.data as VetCalendarRow | null;
  if (!calendar || !calendar.google_calendar_id) {
    return { error: "El veterinario no tiene un calendario asignado. No se puede crear la cita." };
  }

  // Get access token
  const tokenResult = await getValidAccessToken(clinicId);
  if ("error" in tokenResult) {
    if (tokenResult.error === "REAUTH_REQUIRED") {
      return { error: "La conexión con Google Calendar ha expirado. Por favor, reconecta la integración." };
    }
    return { error: "Error al leer los tokens de Google Calendar." };
  }
  const accessToken = tokenResult.access_token;

  // Verify availability
  const slotFree = await isSlotFree(calendar.google_calendar_id, starts_at, ends_at, accessToken);
  if (!slotFree) {
    return { error: "SLOT_NO_LONGER_AVAILABLE" };
  }

  // Create Google Calendar event
  const eventSummary = `${client.name} — ${pet.name} (${service.name})`;
  const eventDescription = [`Cita creada por ${created_by}.`, notes ? `Notas: ${notes}` : ""].filter(Boolean).join("\n");

  let googleEventId: string | null = null;
  try {
    const eventRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.google_calendar_id)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: eventSummary,
          description: eventDescription,
          start: { dateTime: starts_at, timeZone: "Europe/Madrid" },
          end: { dateTime: ends_at, timeZone: "Europe/Madrid" },
        }),
      },
    );

    if (!eventRes.ok) {
      const errText = await eventRes.text();
      console.error("[createAppointmentForClinic] Google event creation failed:", eventRes.status, errText);
      return { error: "No se pudo crear el evento en Google Calendar. Verifica los permisos." };
    }

    const eventData = await eventRes.json();
    googleEventId = eventData.id as string;
    if (!googleEventId) {
      return { error: "Google Calendar no devolvió un ID de evento." };
    }
  } catch (err) {
    console.error("[createAppointmentForClinic] Google API network error:", err);
    return { error: "Error de red al crear el evento en Google Calendar." };
  }

  // INSERT into appointments
  try {
    const { data: inserted, error: insertError } = await (supabaseAdmin.from("appointments") as any).insert({
      clinic_id: clinicId,
      client_id,
      pet_id,
      vet_user_id,
      service_id,
      starts_at,
      ends_at,
      status: "confirmed",
      google_event_id: googleEventId,
      google_calendar_id: calendar.google_calendar_id,
      created_by,
      created_by_user_id: null,
      conversation_id: conversation_id ?? null,
      notes: notes ?? null,
    }).select("id").maybeSingle();

    if (insertError || !inserted) {
      console.error("[createAppointmentForClinic] INSERT error:", insertError);
      if (googleEventId) {
        try {
          await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.google_calendar_id)}/events/${encodeURIComponent(googleEventId)}`,
            { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
          );
        } catch { /* best effort */ }
      }
      return { error: "Error al guardar la cita en la base de datos." };
    }

    return {
      success: true,
      appointment_id: (inserted as { id: string }).id,
      google_event_id: googleEventId,
    };
  } catch (err) {
    console.error("[createAppointmentForClinic] unexpected error:", err);
    if (googleEventId) {
      try {
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.google_calendar_id)}/events/${encodeURIComponent(googleEventId)}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
        );
      } catch { /* best effort */ }
    }
    return { error: "Error inesperado al crear la cita." };
  }
}
