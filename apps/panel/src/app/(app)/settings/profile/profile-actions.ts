"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Schema — single source of truth. Imported by both action and form.
// ---------------------------------------------------------------------------

export const profileSchema = z.object({
  display_name: z
    .string()
    .min(2, "Mínimo 2 caracteres")
    .max(60, "Máximo 60 caracteres")
    .trim(),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export type ProfileFormState = {
  success?: boolean;
  error?: string;
};

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
  const { error } = await query.update(payload).eq("user_id", user.id);

  if (error) {
    return { error: "Error al guardar. Intenta de nuevo." };
  }

  revalidatePath("/settings/profile");
  revalidatePath("/", "layout");

  return { success: true };
}
