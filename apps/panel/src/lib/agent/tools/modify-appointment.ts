import { z } from "zod";
import {
  hasRequiredAppointmentMutationConfirmation,
  isRequestedRescheduleAvailable,
  mergeAppointmentNotes,
  updateGoogleCalendarNotes,
} from "@/lib/agent/appointment-management";
import { isAppointmentIdentityConflict } from "@/lib/appointment-concurrency";
import { checkAvailabilityForClinic } from "@/lib/availability-core";
import { googleCalendarDateTime } from "@/lib/google-calendar-datetime";
import { getValidAccessToken } from "@/lib/google-tokens";
import { uuidSchema } from "@/lib/uuid-schema";
import type { Tool, ToolContext, ToolResult } from "./types";

const inputSchema = z.object({
  appointment_id: uuidSchema,
  starts_at: z.string().datetime({ offset: true }).optional(),
  notes: z.string().trim().min(1).max(500).optional(),
  notes_mode: z.enum(["append", "replace"]).optional(),
});

type Input = z.infer<typeof inputSchema>;

type Output = {
  appointment_id: string;
  modified: boolean;
  already_applied: boolean;
  starts_at?: string;
  notes?: string;
};

type AppointmentRecord = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  google_event_id: string | null;
  google_calendar_id: string | null;
  client_id: string;
  pet_id: string | null;
  service_id: string | null;
  vet_user_id: string | null;
  notes: string | null;
};

function sameInstant(left: string, right: string): boolean {
  return Date.parse(left) === Date.parse(right);
}

async function handler(input: Input, ctx: ToolContext): Promise<ToolResult<Output>> {
  if (!hasRequiredAppointmentMutationConfirmation(ctx.appointmentMutationConfirmed, "modify")) {
    return {
      success: false,
      error: "La modificación requiere confirmación explícita del cliente.",
      error_code: "CONFIRMATION_REQUIRED",
    };
  }

  if (!input.starts_at && !input.notes) {
    return {
      success: false,
      error: "Debes proporcionar al menos starts_at o notes para modificar.",
      error_code: "INVALID_MODIFICATION",
    };
  }

  const supabase = ctx.supabaseAdmin;
  const { data: appointment, error: lookupError } = await supabase
    .from("appointments")
    .select(
      "id, status, starts_at, ends_at, google_event_id, google_calendar_id, client_id, pet_id, service_id, vet_user_id, notes",
    )
    .eq("id", input.appointment_id)
    .eq("clinic_id", ctx.clinicId)
    .maybeSingle();

  if (lookupError) {
    ctx.logger("[modify_appointment] lookup error", lookupError);
    return { success: false, error: "Error al buscar la cita.", error_code: "LOOKUP_FAILED" };
  }
  if (!appointment) {
    return {
      success: false,
      error: "Cita no encontrada en esta clínica.",
      error_code: "APPOINTMENT_NOT_FOUND",
    };
  }

  const appt = appointment as AppointmentRecord;
  if (appt.status !== "confirmed") {
    return {
      success: false,
      error:
        appt.status === "cancelled"
          ? "No se puede modificar una cita cancelada."
          : "Solo se pueden modificar citas confirmadas.",
      error_code: "APPOINTMENT_NOT_MODIFIABLE",
    };
  }

  const changesStart = Boolean(input.starts_at && !sameInstant(input.starts_at, appt.starts_at));
  const newNotes = input.notes
    ? mergeAppointmentNotes(appt.notes, input.notes, input.notes_mode ?? "append")
    : appt.notes;
  const changesNotes = newNotes !== appt.notes;

  if (!changesStart && !changesNotes) {
    return {
      success: true,
      data: {
        appointment_id: input.appointment_id,
        modified: true,
        already_applied: true,
        starts_at: appt.starts_at,
        notes: appt.notes ?? undefined,
      },
    };
  }

  let newStartsAt = appt.starts_at;
  let newEndsAt = appt.ends_at;
  if (changesStart && input.starts_at) {
    if (!appt.service_id || !appt.vet_user_id) {
      return {
        success: false,
        error: "La cita no tiene servicio o veterinario válidos para comprobar disponibilidad.",
        error_code: "APPOINTMENT_DATA_INCOMPLETE",
      };
    }

    const availability = await checkAvailabilityForClinic(ctx.clinicId, {
      service_id: appt.service_id,
      vet_user_id: appt.vet_user_id,
      date_from: input.starts_at,
      date_to: input.starts_at,
    });
    if (!("slots" in availability)) {
      return {
        success: false,
        error: availability.error,
        error_code: "AVAILABILITY_UNAVAILABLE",
      };
    }
    if (!isRequestedRescheduleAvailable(availability.slots, input.starts_at, appt.vet_user_id)) {
      return {
        success: false,
        error: "El horario elegido ya no está disponible. Consulta disponibilidad de nuevo.",
        error_code: "SLOT_NO_LONGER_AVAILABLE",
      };
    }

    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("duration_minutes")
      .eq("id", appt.service_id)
      .eq("clinic_id", ctx.clinicId)
      .maybeSingle();
    if (serviceError || !service) {
      return {
        success: false,
        error: "Servicio asociado no encontrado.",
        error_code: "SERVICE_NOT_FOUND",
      };
    }

    const durationMs = (service as { duration_minutes: number }).duration_minutes * 60 * 1000;
    newStartsAt = input.starts_at;
    newEndsAt = new Date(Date.parse(input.starts_at) + durationMs).toISOString();

    let conflictQuery = supabase
      .from("appointments")
      .select("id")
      .eq("clinic_id", ctx.clinicId)
      .eq("client_id", appt.client_id)
      .eq("vet_user_id", appt.vet_user_id)
      .eq("service_id", appt.service_id)
      .eq("starts_at", newStartsAt)
      .neq("status", "cancelled")
      .neq("id", appt.id);
    conflictQuery = appt.pet_id
      ? conflictQuery.eq("pet_id", appt.pet_id)
      : conflictQuery.is("pet_id", null);
    const { data: conflictingAppointment, error: conflictLookupError } = await conflictQuery
      .limit(1)
      .maybeSingle();
    if (conflictLookupError) {
      ctx.logger("[modify_appointment] identity conflict lookup error", conflictLookupError);
      return {
        success: false,
        error: "No se pudo verificar el nuevo horario. No se modificó la cita.",
        error_code: "IDENTITY_CHECK_FAILED",
      };
    }
    if (conflictingAppointment) {
      return {
        success: false,
        error: "Ya existe esta misma cita activa en el horario elegido.",
        error_code: "SLOT_ALREADY_BOOKED",
      };
    }
  }

  let googleRollback:
    | {
        eventUrl: string;
        accessToken: string;
        originalDescription?: string;
      }
    | undefined;
  if (appt.google_event_id && appt.google_calendar_id) {
    const tokenResult = await getValidAccessToken(ctx.clinicId);
    if ("error" in tokenResult) {
      ctx.logger("[modify_appointment] token error", tokenResult.error);
      return {
        success: false,
        error: "No se pudo obtener acceso a Google Calendar. Reconecta la integración.",
        error_code: "GOOGLE_AUTH_REQUIRED",
      };
    }

    const eventUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(appt.google_calendar_id)}/events/${encodeURIComponent(appt.google_event_id)}`;
    const patchBody: Record<string, unknown> = {};
    let originalDescription: string | undefined;
    if (changesStart) {
      patchBody.start = googleCalendarDateTime(newStartsAt);
      patchBody.end = googleCalendarDateTime(newEndsAt);
    }

    try {
      if (changesNotes && newNotes) {
        const currentEvent = await fetch(eventUrl, {
          headers: { Authorization: `Bearer ${tokenResult.access_token}` },
        });
        if (!currentEvent.ok) {
          ctx.logger("[modify_appointment] Google Calendar GET error", {
            status: currentEvent.status,
          });
          return {
            success: false,
            error: "No se pudo leer el evento de Google Calendar.",
            error_code: "GOOGLE_READ_FAILED",
          };
        }
        const eventData = (await currentEvent.json()) as { description?: string };
        originalDescription = eventData.description;
        patchBody.description = updateGoogleCalendarNotes(eventData.description, newNotes);
      }

      const patchRes = await fetch(eventUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${tokenResult.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patchBody),
      });
      if (!patchRes.ok) {
        ctx.logger("[modify_appointment] Google Calendar PATCH error", {
          status: patchRes.status,
        });
        return {
          success: false,
          error: "No se pudo actualizar el evento en Google Calendar.",
          error_code: "GOOGLE_UPDATE_FAILED",
        };
      }
      googleRollback = {
        eventUrl,
        accessToken: tokenResult.access_token,
        originalDescription,
      };
    } catch (err) {
      ctx.logger("[modify_appointment] Google Calendar network error", err);
      return {
        success: false,
        error: "Error de red al actualizar Google Calendar.",
        error_code: "GOOGLE_NETWORK_ERROR",
      };
    }
  }

  const updateData: Record<string, unknown> = {};
  if (changesStart) {
    updateData.starts_at = newStartsAt;
    updateData.ends_at = newEndsAt;
  }
  if (changesNotes) updateData.notes = newNotes;

  // biome-ignore lint/suspicious/noExplicitAny: Dynamic partial update is validated above.
  const { error: updateError } = await (supabase.from("appointments") as any)
    .update(updateData)
    .eq("id", input.appointment_id)
    .eq("clinic_id", ctx.clinicId);
  if (updateError) {
    ctx.logger("[modify_appointment] update error", updateError);
    if (googleRollback) {
      const rollbackBody: Record<string, unknown> = {};
      if (changesStart) {
        rollbackBody.start = googleCalendarDateTime(appt.starts_at);
        rollbackBody.end = googleCalendarDateTime(appt.ends_at);
      }
      if (changesNotes) rollbackBody.description = googleRollback.originalDescription ?? "";
      try {
        const rollbackResponse = await fetch(googleRollback.eventUrl, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${googleRollback.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(rollbackBody),
        });
        if (!rollbackResponse.ok) {
          ctx.logger("[modify_appointment] Google rollback failed", {
            status: rollbackResponse.status,
          });
        }
      } catch (rollbackError) {
        ctx.logger("[modify_appointment] Google rollback network error", rollbackError);
      }
    }
    if (isAppointmentIdentityConflict(updateError)) {
      return {
        success: false,
        error: "Ya existe esta misma cita activa en el horario elegido.",
        error_code: "SLOT_ALREADY_BOOKED",
      };
    }
    return {
      success: false,
      error:
        "Error al actualizar la cita en la base de datos. Puedes reintentar la misma operación.",
      error_code: "DATABASE_UPDATE_FAILED",
    };
  }

  return {
    success: true,
    data: {
      appointment_id: input.appointment_id,
      modified: true,
      already_applied: false,
      starts_at: changesStart ? newStartsAt : undefined,
      notes: changesNotes ? (newNotes ?? undefined) : undefined,
    },
  };
}

export const modifyAppointmentTool: Tool<Input, Output> = {
  name: "modify_appointment",
  description:
    "Modifica fecha/hora y/o notas de una cita confirmada. REQUIERE una confirmación explícita de la modificación en el turno inmediatamente anterior. Para reprogramar, el Agent debe haber ofrecido un slot de check_availability y la tool vuelve a validar ese slot antes de cambiar nada. notes_mode=append preserva las notas existentes; usa replace solo si el cliente pide sustituirlas. Repeticiones ya aplicadas devuelven already_applied=true.",
  inputSchema,
  handler,
};
