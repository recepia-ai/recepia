"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken } from "@/lib/google-tokens";
import { uuidSchema } from "@/lib/uuid-schema";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const createAppointmentSchema = z.object({
  client_id: uuidSchema,
  pet_id: uuidSchema,
  vet_user_id: uuidSchema,
  service_id: uuidSchema,
  starts_at: z.string().datetime(),
  notes: z.string().optional(),
  conversation_id: uuidSchema.optional(),
  created_by: z.enum(["agent", "admin", "reception"]),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreateAppointmentState = {
  success?: boolean;
  appointment_id?: string;
  google_event_id?: string;
  error?: string;
};

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type ClinicUserRow = { clinic_id: string; role: string };

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

type VetCalendarRow = {
  vet_user_id: string;
  google_calendar_id: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
 * Call Google freeBusy to verify a single slot is still available.
 * Returns true if the slot is free.
 */
async function isSlotFree(
  calendarId: string,
  startsAt: string,
  endsAt: string,
  accessToken: string,
): Promise<boolean> {
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
          timeMin: startsAt,
          timeMax: endsAt,
          items: [{ id: calendarId }],
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("[isSlotFree] freeBusy error:", res.status, errText);
      // On API error, be conservative: treat slot as occupied
      return false;
    }

    const data = await res.json();
    const busy: Array<{ start: string; end: string }> =
      data.calendars?.[calendarId]?.busy ?? [];

    return !busy.some((b) =>
      overlaps(startsAt, endsAt, b.start, b.end),
    );
  } catch (err) {
    console.error("[isSlotFree] network error:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// createAppointment — main server action
// ---------------------------------------------------------------------------

export async function createAppointment(
  input: CreateAppointmentInput,
): Promise<CreateAppointmentState> {
  // ------------------------------------------------------------------
  // 1. Validate input
  // ------------------------------------------------------------------
  const parsed = createAppointmentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "Datos inválidos: " +
        parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const {
    client_id,
    pet_id,
    vet_user_id,
    service_id,
    starts_at,
    notes,
    conversation_id,
    created_by,
  } = parsed.data;

  // ------------------------------------------------------------------
  // 2. Auth — get clinic ID
  // ------------------------------------------------------------------
  const clinicIdOrError = await getCallerClinicId();
  if (typeof clinicIdOrError !== "string") return clinicIdOrError;

  const clinicId = clinicIdOrError;
  const supabaseAdmin = createAdminClient();

  // ------------------------------------------------------------------
  // 3. Load service → duration + surgery validation
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
    return { error: "Servicio no encontrado en esta clínica." };
  }

  const service = serviceData as unknown as ServiceRow;

  // Surgery must go to the designated vet
  if (
    service.is_surgery &&
    service.requires_specific_vet_user_id &&
    vet_user_id !== service.requires_specific_vet_user_id
  ) {
    return { error: "Las cirugías deben asignarse al veterinario designado." };
  }

  // ------------------------------------------------------------------
  // 4. Calculate ends_at
  // ------------------------------------------------------------------
  const durationMs = service.duration_minutes * 60 * 1000;
  const startsAtDate = new Date(starts_at);
  const endsAtDate = new Date(startsAtDate.getTime() + durationMs);
  const ends_at = endsAtDate.toISOString();

  // ------------------------------------------------------------------
  // 5. Validate client and pet belong to this clinic
  // ------------------------------------------------------------------
  const [clientResult, petResult, vetResult, calendarResult] =
    await Promise.all([
      supabaseAdmin
        .from("clients")
        .select("id, name")
        .eq("id", client_id)
        .eq("clinic_id", clinicId)
        .maybeSingle(),
      supabaseAdmin
        .from("pets")
        .select("id, name")
        .eq("id", pet_id)
        .eq("client_id", client_id)
        .maybeSingle(),
      supabaseAdmin
        .from("clinic_users")
        .select("id, display_name")
        .eq("id", vet_user_id)
        .eq("clinic_id", clinicId)
        .eq("staff_type", "vet")
        .maybeSingle(),
      supabaseAdmin
        .from("vet_calendars")
        .select("vet_user_id, google_calendar_id")
        .eq("vet_user_id", vet_user_id)
        .eq("clinic_id", clinicId)
        .maybeSingle(),
    ]);

  const client = clientResult.data as ClientRow | null;
  if (!client) return { error: "Cliente no encontrado en esta clínica." };

  const pet = petResult.data as PetRow | null;
  if (!pet) return { error: "Mascota no encontrada para este cliente." };

  const vet = vetResult.data as VetRow | null;
  if (!vet) return { error: "Veterinario no encontrado en esta clínica." };

  const calendar = calendarResult.data as VetCalendarRow | null;
  if (!calendar || !calendar.google_calendar_id) {
    return {
      error:
        "El veterinario no tiene un calendario asignado. No se puede crear la cita.",
    };
  }

  // ------------------------------------------------------------------
  // 6. Get access token
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
  // 7. Verify availability (race-condition guard)
  // ------------------------------------------------------------------
  const slotFree = await isSlotFree(
    calendar.google_calendar_id,
    starts_at,
    ends_at,
    accessToken,
  );

  if (!slotFree) {
    return { error: "SLOT_NO_LONGER_AVAILABLE" };
  }

  // ------------------------------------------------------------------
  // 8. Create Google Calendar event
  // ------------------------------------------------------------------
  const eventSummary = `${client.name} — ${pet.name} (${service.name})`;
  const eventDescription = [
    `Cita creada por ${created_by}.`,
    notes ? `Notas: ${notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

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
          start: {
            dateTime: starts_at,
            timeZone: "Europe/Madrid",
          },
          end: {
            dateTime: ends_at,
            timeZone: "Europe/Madrid",
          },
        }),
      },
    );

    if (!eventRes.ok) {
      const errText = await eventRes.text();
      console.error(
        "[createAppointment] Google event creation failed:",
        eventRes.status,
        errText,
      );
      return {
        error:
          "No se pudo crear el evento en Google Calendar. Verifica los permisos.",
      };
    }

    const eventData = await eventRes.json();
    googleEventId = eventData.id as string;

    if (!googleEventId) {
      return { error: "Google Calendar no devolvió un ID de evento." };
    }
  } catch (err) {
    console.error("[createAppointment] Google API network error:", err);
    return { error: "Error de red al crear el evento en Google Calendar." };
  }

  // ------------------------------------------------------------------
  // 9. INSERT into appointments
  // ------------------------------------------------------------------
  try {
    const { data: inserted, error: insertError } = await (supabaseAdmin
      .from("appointments") as any)
      .insert({
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
        created_by_user_id: null, // Will be set when created_by != "agent"
        conversation_id: conversation_id ?? null,
        notes: notes ?? null,
      })
      .select("id")
      .maybeSingle();

    if (insertError || !inserted) {
      console.error("[createAppointment] INSERT error:", insertError);

      // ------------------------------------------------------------------
      // Rollback: delete the Google Calendar event
      // ------------------------------------------------------------------
      if (googleEventId) {
        try {
          await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.google_calendar_id)}/events/${encodeURIComponent(googleEventId)}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            },
          );
        } catch (rollbackErr) {
          console.error(
            "[createAppointment] Rollback (delete Google event) failed:",
            rollbackErr,
          );
        }
      }

      return { error: "Error al guardar la cita en la base de datos." };
    }

    const appointmentId = (inserted as { id: string }).id;

    // ------------------------------------------------------------------
    // 10. Revalidate paths
    // ------------------------------------------------------------------
    revalidatePath("/calendar");
    revalidatePath(`/clients/${client_id}`);
    if (conversation_id) {
      revalidatePath(`/conversations/${conversation_id}`);
    }

    return {
      success: true,
      appointment_id: appointmentId,
      google_event_id: googleEventId,
    };
  } catch (err) {
    console.error("[createAppointment] unexpected error:", err);

    // Rollback Google event on unexpected errors too
    if (googleEventId) {
      try {
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.google_calendar_id)}/events/${encodeURIComponent(googleEventId)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
      } catch {
        // Best effort
      }
    }

    return { error: "Error inesperado al crear la cita." };
  }
}
