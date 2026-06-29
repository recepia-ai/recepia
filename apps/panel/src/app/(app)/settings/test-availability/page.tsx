import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadServicesForClinic, loadVetsForClinic } from "./_actions/test-helpers";
import { TestAvailabilityClient } from "./test-availability-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClinicUserRow = { clinic_id: string; role: string };

// ---------------------------------------------------------------------------
// Page (Server Component)
// ---------------------------------------------------------------------------

export default async function TestAvailabilityPage() {
  const supabase = await createClient();

  // ---------- Admin guard ----------
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinic_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  const cu = clinicUser as ClinicUserRow | null;
  if (!cu) redirect("/settings");
  if (cu.role !== "admin") redirect("/settings");

  // ---------- Load services + vets in parallel ----------
  const [servicesResult, vetsResult] = await Promise.all([
    loadServicesForClinic(),
    loadVetsForClinic(),
  ]);

  const services = "error" in servicesResult ? [] : servicesResult.services;
  const vets = "error" in vetsResult ? [] : vetsResult.vets;

  // Compute defaults
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const toLocalISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const defaultDateFrom = toLocalISO(today);
  const defaultDateTo = toLocalISO(nextWeek);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-stone-900">
            Test de disponibilidad
          </h2>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            Admin only
          </span>
        </div>
        <p className="mt-0.5 text-xs text-stone-500">
          Prueba checkAvailability y createAppointment contra datos reales.
          Todas las citas creadas llevan prefijo [TEST].
        </p>
      </div>

      <TestAvailabilityClient
        services={services}
        vets={vets}
        defaultDateFrom={defaultDateFrom}
        defaultDateTo={defaultDateTo}
      />
    </div>
  );
}
