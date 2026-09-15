import { getSettingsContext } from "../operations-context";
import { type VeterinarianItem, VeterinariansManager } from "./veterinarians-manager";

export default async function SettingsVeterinariansPage() {
  const contextResult = await getSettingsContext();
  if (!contextResult.ok) {
    return (
      <p className="rounded-xl border border-stone-200 bg-white p-5 text-sm">
        {contextResult.error}
      </p>
    );
  }
  const { supabase, clinicId, role } = contextResult.context;
  const [vetsResult, calendarsResult, assignmentsResult, hoursResult] = await Promise.all([
    supabase
      .from("clinic_users")
      .select("id, user_id, display_name, email, role, staff_type, specialty_primary")
      .eq("clinic_id", clinicId)
      .eq("staff_type", "vet")
      .order("display_name", { ascending: true }),
    supabase
      .from("vet_calendars")
      .select("vet_user_id, calendar_summary, sync_enabled, last_synced_at")
      .eq("clinic_id", clinicId),
    supabase.from("service_vet_assignments").select("vet_user_id").eq("clinic_id", clinicId),
    supabase.from("vet_consultation_hours").select("vet_user_id").eq("clinic_id", clinicId),
  ]);

  const calendars = calendarsResult.data ?? [];
  const assignments = assignmentsResult.data ?? [];
  const hours = hoursResult.data ?? [];
  const vets: VeterinarianItem[] = (vetsResult.data ?? []).map((vet) => {
    const calendar = calendars.find((item) => item.vet_user_id === vet.id);
    return {
      ...vet,
      calendar_summary: calendar?.calendar_summary ?? null,
      calendar_connected: Boolean(calendar),
      calendar_sync_enabled: calendar?.sync_enabled ?? false,
      calendar_last_synced_at: calendar?.last_synced_at ?? null,
      service_count: assignments.filter((item) => item.vet_user_id === vet.id).length,
      interval_count: hours.filter((item) => item.vet_user_id === vet.id).length,
    };
  });

  return <VeterinariansManager veterinarians={vets} readOnly={role !== "admin"} />;
}
