"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DATABASE_UUID_PATTERN, isValidConsultationInterval } from "@/lib/operations-config";
import { getAdminSettingsContext } from "../operations-context";

export type ScheduleActionState = { success?: boolean; error?: string };
const intervalSchema = z.object({
  interval_id: z.string().regex(DATABASE_UUID_PATTERN).optional(),
  vet_user_id: z.string().regex(DATABASE_UUID_PATTERN).optional(),
  day_of_week: z.coerce.number().int().min(0).max(6),
  start_time: z.string(),
  end_time: z.string(),
});

function parseInterval(formData: FormData) {
  return intervalSchema.safeParse({
    interval_id: formData.get("interval_id") || undefined,
    vet_user_id: formData.get("vet_user_id") || undefined,
    day_of_week: formData.get("day_of_week"),
    start_time: formData.get("start_time"),
    end_time: formData.get("end_time"),
  });
}

function refreshSchedules() {
  revalidatePath("/settings/schedules");
  revalidatePath("/settings/test-availability");
  revalidatePath("/calendar");
}

export async function createConsultationInterval(
  _previous: ScheduleActionState,
  formData: FormData,
): Promise<ScheduleActionState> {
  const parsed = parseInterval(formData);
  if (!parsed.success || !parsed.data.vet_user_id) return { error: "Intervalo no válido" };
  if (!isValidConsultationInterval(parsed.data.start_time, parsed.data.end_time)) {
    return { error: "La hora final debe ser posterior a la inicial." };
  }
  const contextResult = await getAdminSettingsContext();
  if (!contextResult.ok) return { error: contextResult.error };
  const { supabase, clinicId } = contextResult.context;
  const { data: vet } = await supabase
    .from("clinic_users")
    .select("id")
    .eq("id", parsed.data.vet_user_id)
    .eq("clinic_id", clinicId)
    .eq("staff_type", "vet")
    .maybeSingle();
  if (!vet) return { error: "Veterinario no encontrado en esta clínica." };

  const { error } = await supabase.from("vet_consultation_hours").insert({
    clinic_id: clinicId,
    vet_user_id: parsed.data.vet_user_id,
    day_of_week: parsed.data.day_of_week,
    start_time: parsed.data.start_time,
    end_time: parsed.data.end_time,
  });
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe un intervalo que empieza a esa hora."
          : "No se pudo crear el intervalo.",
    };
  }
  refreshSchedules();
  return { success: true };
}

export async function updateConsultationInterval(
  _previous: ScheduleActionState,
  formData: FormData,
): Promise<ScheduleActionState> {
  const parsed = parseInterval(formData);
  if (!parsed.success || !parsed.data.interval_id) return { error: "Intervalo no válido" };
  if (!isValidConsultationInterval(parsed.data.start_time, parsed.data.end_time)) {
    return { error: "La hora final debe ser posterior a la inicial." };
  }
  const contextResult = await getAdminSettingsContext();
  if (!contextResult.ok) return { error: contextResult.error };
  const { supabase, clinicId } = contextResult.context;
  const { data, error } = await supabase
    .from("vet_consultation_hours")
    .update({
      day_of_week: parsed.data.day_of_week,
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
    })
    .eq("id", parsed.data.interval_id)
    .eq("clinic_id", clinicId)
    .select("id")
    .maybeSingle();
  if (error) return { error: "No se pudo actualizar el intervalo." };
  if (!data) return { error: "Intervalo no encontrado en esta clínica." };
  refreshSchedules();
  return { success: true };
}

export async function deleteConsultationInterval(intervalId: string): Promise<ScheduleActionState> {
  const parsed = z.string().regex(DATABASE_UUID_PATTERN).safeParse(intervalId);
  if (!parsed.success) return { error: "Intervalo no válido" };
  const contextResult = await getAdminSettingsContext();
  if (!contextResult.ok) return { error: contextResult.error };
  const { supabase, clinicId } = contextResult.context;
  const { data, error } = await supabase
    .from("vet_consultation_hours")
    .delete()
    .eq("id", parsed.data)
    .eq("clinic_id", clinicId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "No se pudo eliminar el intervalo." };
  refreshSchedules();
  return { success: true };
}
