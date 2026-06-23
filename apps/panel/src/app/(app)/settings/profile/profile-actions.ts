"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { profileSchema, type ProfileFormState } from "./profile-schema";

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function updateProfile(
  prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "No autenticado" };

  const raw = { display_name: formData.get("display_name") };
  const parsed = profileSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const payload = { display_name: parsed.data.display_name };
  // The typed SupabaseClient.from("clinic_users").update() resolves the parameter
  // to `never` — a consequence of the union-constrained generic in postgrest-js
  // (GenericTable | GenericView). Casting the query builder to `any` is the
  // standard escape hatch; the runtime behaviour is correct.
  const query = supabase.from("clinic_users") as any;
  const { data: updated, error } = await query
    .update(payload)
    .eq("user_id", user.id)
    .select()
    .maybeSingle();

  if (error) {
    return { error: "Error al guardar. Intenta de nuevo." };
  }

  if (!updated) {
    console.error("[updateProfile] UPDATE affected 0 rows. RLS policy missing?");
    return { error: "No tienes permiso para editar tu perfil." };
  }

  revalidatePath("/settings/profile");
  revalidatePath("/", "layout");

  return { success: true };
}
