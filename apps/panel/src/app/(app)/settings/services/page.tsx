import { getSettingsContext } from "../operations-context";
import { type ServiceItem, ServicesManager, type ServiceVet } from "./services-manager";

export default async function SettingsServicesPage() {
  const contextResult = await getSettingsContext();
  if (!contextResult.ok) {
    return (
      <p className="rounded-xl border border-stone-200 bg-white p-5 text-sm">
        {contextResult.error}
      </p>
    );
  }
  const { supabase, clinicId, role } = contextResult.context;
  const [servicesResult, vetsResult, assignmentsResult] = await Promise.all([
    supabase
      .from("services")
      .select(
        "id, name, slug, description, duration_minutes, price_min_cents, price_max_cents, is_surgery, requires_fasting, escalates_for_pricing, requires_specific_vet_user_id, active, sort_order",
      )
      .eq("clinic_id", clinicId)
      .order("active", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("clinic_users")
      .select("id, display_name, email")
      .eq("clinic_id", clinicId)
      .eq("staff_type", "vet")
      .order("display_name", { ascending: true }),
    supabase
      .from("service_vet_assignments")
      .select("service_id, vet_user_id")
      .eq("clinic_id", clinicId),
  ]);

  const assignments = assignmentsResult.data ?? [];
  const services: ServiceItem[] = (servicesResult.data ?? []).map((service) => ({
    ...service,
    assigned_vet_ids: assignments
      .filter((assignment) => assignment.service_id === service.id)
      .map((assignment) => assignment.vet_user_id),
  }));
  const vets: ServiceVet[] = (vetsResult.data ?? []).map((vet) => ({
    id: vet.id,
    name: vet.display_name ?? vet.email ?? "Veterinario sin nombre",
  }));

  return <ServicesManager services={services} vets={vets} readOnly={role !== "admin"} />;
}
