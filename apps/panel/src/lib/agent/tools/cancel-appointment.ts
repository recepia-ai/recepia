import { z } from "zod";
import { uuidSchema } from "@/lib/uuid-schema";
import { getValidAccessToken } from "@/lib/google-tokens";
import type { Tool, ToolResult, ToolContext } from "./types";

const inputSchema = z.object({
  appointment_id: uuidSchema,
  reason: z.string().trim().min(1, "El motivo de cancelación es obligatorio").max(500),
});

type Input = z.infer<typeof inputSchema>;

type Output = {
  appointment_id: string;
  cancelled: boolean;
};

async function handler(input: Input, ctx: ToolContext): Promise<ToolResult<Output>> {
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
    return { success: false, error: "Error al buscar la cita." };
  }

  if (!appointment) {
    return { success: false, error: "Cita no encontrada en esta clínica." };
  }

  const appt = appointment as {
    id: string;
    status: string;
    google_event_id: string | null;
    google_calendar_id: string | null;
    vet_user_id: string | null;
  };

  if (appt.status === "cancelled") {
    return { success: false, error: "La cita ya está cancelada." };
  }

  // Delete Google Calendar event if it exists
  if (appt.google_event_id && appt.google_calendar_id) {
    const tokenResult = await getValidAccessToken(ctx.clinicId);
    if ("error" in tokenResult) {
      ctx.logger("[cancel_appointment] token error", tokenResult.error);
      return { success: false, error: "No se pudo obtener acceso a Google Calendar. Reconoce la integración." };
    }

    try {
      const deleteRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(appt.google_calendar_id)}/events/${encodeURIComponent(appt.google_event_id)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${tokenResult.access_token}` },
        },
      );

      if (!deleteRes.ok && deleteRes.status !== 410) {
        const errText = await deleteRes.text();
        ctx.logger("[cancel_appointment] Google Calendar DELETE error", { status: deleteRes.status, body: errText });
      }
    } catch (err) {
      ctx.logger("[cancel_appointment] Google Calendar network error (non-fatal)", err);
    }
  }

  // Update appointment status to cancelled
  const { error: updateError } = await supabase
    .from("appointments")
    .update({
      status: "cancelled",
      cancellation_reason: input.reason,
    })
    .eq("id", input.appointment_id);

  if (updateError) {
    ctx.logger("[cancel_appointment] update error", updateError);
    return { success: false, error: "Error al cancelar la cita en la base de datos." };
  }

  return {
    success: true,
    data: {
      appointment_id: input.appointment_id,
      cancelled: true,
    },
  };
}

export const cancelAppointmentTool: Tool<Input, Output> = {
  name: "cancel_appointment",
  description:
    "Cancela una cita existente. Busca la cita por appointment_id, elimina el evento de Google Calendar, y la marca como cancelada. Requiere el motivo de cancelación.",
  inputSchema,
  handler,
};
