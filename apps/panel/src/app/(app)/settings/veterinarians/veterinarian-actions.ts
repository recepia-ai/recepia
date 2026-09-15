"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DATABASE_UUID_PATTERN } from "@/lib/operations-config";
import { getAdminSettingsContext } from "../operations-context";

export type VeterinarianActionState = { success?: boolean; error?: string };

const veterinarianSchema = z.object({
  vet_user_id: z.string().regex(DATABASE_UUID_PATTERN),
  display_name: z.string().trim().min(2, "El nombre es demasiado corto").max(120),
  specialty_primary: z.string().trim().max(160).optional().default(""),
});

export async function updateVeterinarian(
  _previous: VeterinarianActionState,
  formData: FormData,
): Promise<VeterinarianActionState> {
  const parsed = veterinarianSchema.safeParse({
    vet_user_id: formData.get("vet_user_id"),
    display_name: formData.get("display_name"),
    specialty_primary: formData.get("specialty_primary"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const contextResult = await getAdminSettingsContext();
  if (!contextResult.ok) return { error: contextResult.error };
  const { supabase, clinicId } = contextResult.context;

  const { data, error } = await supabase
    .from("clinic_users")
    .update({
      display_name: parsed.data.display_name,
      specialty_primary: parsed.data.specialty_primary || null,
    })
    .eq("id", parsed.data.vet_user_id)
    .eq("clinic_id", clinicId)
    .eq("staff_type", "vet")
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[updateVeterinarian]", { code: error.code, message: error.message });
    return { error: "No se pudo actualizar el veterinario." };
  }
  if (!data) return { error: "Veterinario no encontrado en esta clínica." };
  revalidatePath("/settings/veterinarians");
  revalidatePath("/settings/services");
  revalidatePath("/settings/schedules");
  revalidatePath("/settings/integrations");
  return { success: true };
}
