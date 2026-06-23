"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { clinicSchema, type ClinicFormState } from "./clinic-schema";

type ClinicUserRow = { clinic_id: string; role: string };

export async function updateClinic(
  _prevState: ClinicFormState,
  formData: FormData,
): Promise<ClinicFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // Solo admins pueden editar la clínica
  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinic_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  const cu = clinicUser as ClinicUserRow | null;
  if (!cu) return { error: "Sin clínica asignada" };
  if (cu.role !== "admin")
    return { error: "Solo el administrador puede editar la clínica" };

  const raw = {
    name: formData.get("name"),
    legal_name: formData.get("legal_name"),
    tax_id: formData.get("tax_id"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address_street: formData.get("address_street"),
    address_city: formData.get("address_city"),
    address_postal_code: formData.get("address_postal_code"),
    address_country: formData.get("address_country"),
    locale: formData.get("locale"),
    timezone: formData.get("timezone"),
  };

  const parsed = clinicSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  // Empty strings -> null para campos opcionales
  // Campos con default se mantienen si están vacíos (locales, tz, country)
  const payload = {
    name: parsed.data.name,
    legal_name: parsed.data.legal_name || null,
    tax_id: parsed.data.tax_id || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    address_street: parsed.data.address_street || null,
    address_city: parsed.data.address_city || null,
    address_postal_code: parsed.data.address_postal_code || null,
    address_country: parsed.data.address_country || "ES",
    locale: parsed.data.locale || "es-ES",
    timezone: parsed.data.timezone || "Europe/Madrid",
  };

  const query = supabase.from("clinics") as any;
  const { error } = await query.update(payload).eq("id", cu.clinic_id);

  if (error) {
    console.error("[updateClinic]", error);
    return { error: "Error al guardar. Intenta de nuevo." };
  }

  revalidatePath("/settings/clinic");
  revalidatePath("/", "layout"); // sidebar refresca nombre de clínica
  return { success: true };
}
