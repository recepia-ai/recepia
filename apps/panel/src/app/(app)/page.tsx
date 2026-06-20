import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ClinicUserRow = {
  role: string;
  clinic_id: string;
  clinics: { name: string } | { name: string }[] | null;
};

export default async function DashboardPage() {
  // Static metrics for now — will be wired to real queries in E7.
  const METRICS = [
    { label: "Conversaciones hoy", value: "—" },
    { label: "Citas hoy", value: "—" },
    { label: "Pendientes", value: "—" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Bienvenido a Recepia
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Aquí verás un resumen de tu clínica.
        </p>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-6">
        {METRICS.map((m) => (
          <Card key={m.label} className="rounded-xl border-zinc-200 shadow-sm">
            <CardContent className="p-6">
              <p className="text-3xl font-semibold text-zinc-900">
                {m.value}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Clinic info */}
      <ClinicInfoCard />
    </div>
  );
}

// -- Internal: clinic info card --------------------------------------------

async function ClinicInfoCard() {
  const { createClient } = await import("@/lib/supabase/server");

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await supabase
    .from("clinic_users")
    .select("role, clinic_id, clinics(name)")
    .eq("user_id", user!.id)
    .maybeSingle();

  const clinicUser = result.data as ClinicUserRow | null;

  const clinic = clinicUser
    ? Array.isArray(clinicUser.clinics)
      ? clinicUser.clinics[0] ?? null
      : clinicUser.clinics
    : null;

  return (
    <Card className="rounded-xl border-zinc-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-zinc-900">
          Tu clínica
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">Nombre</span>
          <span className="font-medium text-zinc-900">
            {clinic?.name ?? "Sin nombre"}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">Tu rol</span>
          <span className="font-medium text-zinc-900">
            {clinicUser?.role ?? "—"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
