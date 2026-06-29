import { createClient } from "@/lib/supabase/server";
import type { ServiceOption, VetOption } from "../_schemas/test-schemas";

// ---------------------------------------------------------------------------
// Server-only helpers (called from server components, NOT "use server")
// ---------------------------------------------------------------------------

type ClinicUserRow = { clinic_id: string; role: string };

export async function getAdminClinicId(): Promise<string | { error: string }> {
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
  if (cu.role !== "admin") return { error: "Solo el administrador puede acceder" };

  return cu.clinic_id;
}

export async function loadServicesForClinic(): Promise<
  { services: ServiceOption[] } | { error: string }
> {
  const clinicIdOrError = await getAdminClinicId();
  if (typeof clinicIdOrError !== "string") return clinicIdOrError;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("services")
    .select("id, name, duration_minutes, is_surgery")
    .eq("clinic_id", clinicIdOrError)
    .order("name", { ascending: true });

  if (error) {
    console.error("[loadServices] error:", error);
    return { error: "Error al cargar servicios." };
  }

  const services = (data ?? []) as unknown as ServiceOption[];
  return { services };
}

export async function loadVetsForClinic(): Promise<
  { vets: VetOption[] } | { error: string }
> {
  const clinicIdOrError = await getAdminClinicId();
  if (typeof clinicIdOrError !== "string") return clinicIdOrError;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clinic_users")
    .select("id, display_name")
    .eq("clinic_id", clinicIdOrError)
    .eq("staff_type", "vet")
    .order("display_name", { ascending: true });

  if (error) {
    console.error("[loadVets] error:", error);
    return { error: "Error al cargar veterinarios." };
  }

  const vets = (data ?? []) as unknown as VetOption[];
  return { vets };
}
