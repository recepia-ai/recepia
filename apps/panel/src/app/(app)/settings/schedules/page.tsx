import { getSettingsContext } from "../operations-context";
import { SchedulesManager, type ScheduleVet } from "./schedules-manager";

export default async function SettingsSchedulesPage() {
  const contextResult = await getSettingsContext();
  if (!contextResult.ok) {
    return (
      <p className="rounded-xl border border-stone-200 bg-white p-5 text-sm">
        {contextResult.error}
      </p>
    );
  }
  const { supabase, clinicId, role } = contextResult.context;
  const [vetsResult, hoursResult] = await Promise.all([
    supabase
      .from("clinic_users")
      .select("id, display_name, email")
      .eq("clinic_id", clinicId)
      .eq("staff_type", "vet")
      .order("display_name", { ascending: true }),
    supabase
      .from("vet_consultation_hours")
      .select("id, vet_user_id, day_of_week, start_time, end_time")
      .eq("clinic_id", clinicId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
  ]);
  const hours = hoursResult.data ?? [];
  const vets: ScheduleVet[] = (vetsResult.data ?? []).map((vet) => ({
    id: vet.id,
    name: vet.display_name ?? vet.email ?? "Veterinario sin nombre",
    intervals: hours.filter((interval) => interval.vet_user_id === vet.id),
  }));
  return <SchedulesManager veterinarians={vets} readOnly={role !== "admin"} />;
}
