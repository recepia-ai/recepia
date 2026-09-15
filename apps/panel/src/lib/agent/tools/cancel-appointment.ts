import { z } from "zod";
import { hasRequiredAppointmentMutationConfirmation } from "@/lib/agent/appointment-management";
import { getValidAccessToken } from "@/lib/google-tokens";
import { uuidSchema } from "@/lib/uuid-schema";
import type { Tool, ToolContext, ToolResult } from "./types";

const inputSchema = z.object({
  appointment_id: uuidSchema,
  reason: z.string().trim().min(1, "El motivo de cancelación es obligatorio").max(500),
});

type Input = z.infer<typeof inputSchema>;

type Output = {
  appointment_id: string;
  cancelled: boolean;
  already_applied: boolean;
};

async function handler(input: Input, ctx: ToolContext): Promise<ToolResult<Output>> {
  if (!hasRequiredAppointmentMutationConfirmation(ctx.appointmentMutationConfirmed, "cancel")) {
    return {
      success: false,
      error: "La cancelación requiere confirmación explícita del cliente.",
      error_code: "CONFIRMATION_REQUIRED",
    };
  }

  const supabase = ctx.supabaseAdmin;

  // Look up the appointment
  const { data: appointment, error: lookupError } = await supabase
    .from("appointments")
    .select("id, status, google_event_id, google_calendar_id, vet_user_id")
    .eq("id", input.appointment_id)
    .eq("clinic_id", ctx.clinicId)
    .maybeSingle();

  if (lookupError) {
    ctx.logger("[cancel_appointment] lookup error", lookupError);
    return { success: false, error: "Error al buscar la cita.", error_code: "LOOKUP_FAILED" };
  }

  if (!appointment) {
    return {
      success: false,
      error: "Cita no encontrada en esta clínica.",
      error_code: "APPOINTMENT_NOT_FOUND",
    };
  }

  const appt = appointment as {
    id: string;
    status: string;
    google_event_id: string | null;
    google_calendar_id: string | null;
    vet_user_id: string | null;
  };

  if (appt.status === "cancelled") {
    return {
      success: true,
      data: {
        appointment_id: input.appointment_id,
        cancelled: true,
        already_applied: true,
      },
    };
  }
  if (appt.status !== "confirmed") {
    return {
      success: false,
      error: "Solo se pueden cancelar citas confirmadas.",
      error_code: "APPOINTMENT_NOT_CANCELLABLE",
    };
  }

  // Delete Google Calendar event if it exists
  if (appt.google_event_id && appt.google_calendar_id) {
    const tokenResult = await getValidAccessToken(ctx.clinicId);
    if ("error" in tokenResult) {
      ctx.logger("[cancel_appointment] token error", tokenResult.error);
      return {
        success: false,
        error: "No se pudo obtener acceso a Google Calendar. Reconecta la integración.",
        error_code: "GOOGLE_AUTH_REQUIRED",
      };
    }

    try {
      const deleteRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(appt.google_calendar_id)}/events/${encodeURIComponent(appt.google_event_id)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${tokenResult.access_token}` },
        },
      );

      if (!deleteRes.ok && deleteRes.status !== 404 && deleteRes.status !== 410) {
        ctx.logger("[cancel_appointment] Google Calendar DELETE error", {
          status: deleteRes.status,
        });
        return {
          success: false,
          error: "No se pudo cancelar el evento en Google Calendar.",
          error_code: "GOOGLE_DELETE_FAILED",
        };
      }
    } catch (err) {
      ctx.logger("[cancel_appointment] Google Calendar network error", err);
      return {
        success: false,
        error: "Error de red al cancelar el evento en Google Calendar.",
        error_code: "GOOGLE_NETWORK_ERROR",
      };
    }
  }

  // Update appointment status to cancelled
  const { error: updateError } = await supabase
    .from("appointments")
    .update({
      status: "cancelled",
      cancellation_reason: input.reason,
    })
    .eq("id", input.appointment_id)
    .eq("clinic_id", ctx.clinicId);

  if (updateError) {
    ctx.logger("[cancel_appointment] update error", updateError);
    return {
      success: false,
      error: "Error al cancelar la cita en la base de datos. Puedes reintentar la misma operación.",
      error_code: "DATABASE_UPDATE_FAILED",
    };
  }

  return {
    success: true,
    data: {
      appointment_id: input.appointment_id,
      cancelled: true,
      already_applied: false,
    },
  };
}

export const cancelAppointmentTool: Tool<Input, Output> = {
  name: "cancel_appointment",
  description:
    "Cancela una cita confirmada. REQUIERE una confirmación explícita y pura de la cancelación en el turno inmediatamente anterior. Elimina el evento de Google Calendar y marca la cita como cancelada. Una repetición segura devuelve already_applied=true.",
  inputSchema,
  handler,
};
