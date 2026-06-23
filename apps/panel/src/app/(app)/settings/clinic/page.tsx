import { createClient } from "@/lib/supabase/server";
import { ClinicForm } from "./clinic-form";
import type { ClinicFormValues } from "./clinic-schema";

type ClinicUserRow = { clinic_id: string; role: string };

type ClinicRow = {
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  address_street: string | null;
  address_city: string | null;
  address_postal_code: string | null;
  address_country: string | null;
  locale: string;
  timezone: string;
};

export default async function SettingsClinicPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinic_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  const cu = clinicUser as ClinicUserRow | null;

  if (!cu)
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
        <p className="text-sm text-stone-500">
          No estás asignado a ninguna clínica.
        </p>
      </div>
    );

  const { data: clinic } = await supabase
    .from("clinics")
    .select("*")
    .eq("id", cu.clinic_id)
    .maybeSingle();

  const cl = clinic as ClinicRow | null;

  if (!cl)
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
        <p className="text-sm text-stone-500">Clínica no encontrada.</p>
      </div>
    );

  const isAdmin = cu.role === "admin";
  const defaults: ClinicFormValues = {
    name: cl.name ?? "",
    legal_name: cl.legal_name ?? "",
    tax_id: cl.tax_id ?? "",
    email: cl.email ?? "",
    phone: cl.phone ?? "",
    address_street: cl.address_street ?? "",
    address_city: cl.address_city ?? "",
    address_postal_code: cl.address_postal_code ?? "",
    address_country: cl.address_country ?? "ES",
    locale: cl.locale ?? "es-ES",
    timezone: cl.timezone ?? "Europe/Madrid",
  };

  return <ClinicForm defaultValues={defaults} readOnly={!isAdmin} />;
}
