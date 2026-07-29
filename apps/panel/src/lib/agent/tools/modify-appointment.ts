import { z } from "zod";
import { uuidSchema } from "@/lib/uuid-schema";
import { getValidAccessToken } from "@/lib/google-tokens";
import type { Tool, ToolResult, ToolContext } from "./types";

const inputSchema = z.object({
  appointment_id: uuidSchema,
  starts_at: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(500).optional(),
});

type Input = z.infer<typeof inputSchema>;

type Output = {
  appointment_id: string;
  modified: boolean;
  starts_at?: string;
};

async function handler(input: Input, ctx: ToolContext): Promise<ToolResult<Output>> {
  const supabase = ctx.supabaseAdmin;

  if (!input.starts_at && !input.notes) {
    return { success: false, error: "Debes proporcionar al menos starts_at o notes para modificar." };
  }

  // Look up the appointment with service info
  const { data: appointment, error: lookupError } = await supabase
    .from("appointments")
    .select("id, status, starts_at, ends_at, google_event_id, google_calendar_id, service_id, vet_user_id, notes")
    .eq("id", input.appointment_id)
    .eq("clinic_id", ctx.clinicId)
    .maybeSingle();

  if (lookupError) {
    ctx.logger("[modify_appointment] lookup error", lookupError);
    return { success: false, error: "Error al buscar la cita." };
  }

  if (!appointment) {
    return { success: false, error: "Cita no encontrada en esta clínica." };
  }

  const appt = appointment as {
    id: string;
    status: string;
    starts_at: string;
    ends_at: string;
    google_event_id: string | null;
    google_calendar_id: string | null;
    service_id: string;
    vet_user_id: string | null;
    notes: string | null;
  };

  if (appt.status === "cancelled") {
    return { success: false, error: "No se puede modificar una cita cancelada." };
  }

  let newStartsAt = appt.starts_at;
  let newEndsAt = appt.ends_at;
  let newNotes = input.notes ?? appt.notes;

  // Recalculate ends_at if starts_at changed
  if (input.starts_at && input.starts_at !== appt.starts_at) {
    const { data: service } = await supabase
      .from("services")
      .select("duration_minutes")
      .eq("id", appt.service_id)
      .eq("clinic_id", ctx.clinicId)
      .maybeSingle();

    if (!service) {
      return { success: false, error: "Servicio asociado no encontrado." };
    }

    const durationMs = (service as { duration_minutes: number }).duration_minutes * 60 * 1000;
    newStartsAt = input.starts_at;
    newEndsAt = new Date(new Date(input.starts_at).getTime() + durationMs).toISOString();
  }

  // Update Google Calendar event if it exists
  if (appt.google_event_id && appt.google_calendar_id) {
    const tokenResult = await getValidAccessToken(ctx.clinicId);
    if ("error" in tokenResult) {
      ctx.logger("[modify_appointment] token error", tokenResult.error);
      return { success: false, error: "No se pudo obtener acceso a Google Calendar. Reconoce la integración." };
    }

    const patchBody: Record<string, unknown> = {};
    if (input.starts_at) {
      patchBody.start = { dateTime: newStartsAt, timeZone: "Europe/Madrid" };
      patchBody.end = { dateTime: newEndsAt, timeZone: "Europe/Madrid" };
    }

    try {
      const patchRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(appt.google_calendar_id)}/events/${encodeURIComponent(appt.google_event_id)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${tokenResult.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(patchBody),
        },
      );

      if (!patchRes.ok) {
        const errText = await patchRes.text();
        ctx.logger("[modify_appointment] Google Calendar PATCH error", { status: patchRes.status, body: errText });
        return { success: false, error: "No se pudo actualizar el evento en Google Calendar." };
      }
    } catch (err) {
      ctx.logger("[modify_appointment] Google Calendar network error", err);
      return { success: false, error: "Error de red al actualizar Google Calendar." };
    }
  }

  // Update appointment in DB
  const updateData: Record<string, unknown> = {};
  if (input.starts_at) {
    updateData.starts_at = newStartsAt;
    updateData.ends_at = newEndsAt;
  }
  if (input.notes) {
    updateData.notes = input.notes;
  }

  const { error: updateError } = await (supabase
    .from("appointments") as any)
    .update(updateData)
    .eq("id", input.appointment_id);

  if (updateError) {
    ctx.logger("[modify_appointment] update error", updateError);
    return { success: false, error: "Error al actualizar la cita en la base de datos." };
  }

  return {
    success: true,
    data: {
      appointment_id: input.appointment_id,
      modified: true,
      starts_at: input.starts_at ? newStartsAt : undefined,
    },
  };
}

export const modifyAppointmentTool: Tool<Input, Output> = {
  name: "modify_appointment",
  description:
    "Modifica una cita existente (fecha/hora y/o notas). No se puede modificar una cita cancelada. Si cambias la fecha, recalcula la hora de fin según la duración del servicio.",
  inputSchema,
  handler,
};
