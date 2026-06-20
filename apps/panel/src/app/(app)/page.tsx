import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

type ClinicUserRow = {
  role: string;
  clinic_id: string;
  clinics: { name: string } | { name: string }[] | null;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  recepcion: "Recepción",
  veterinario: "Veterinario",
};

/** Extracts the first name from an email address (before @ or before dot). */
function extractFirstName(email: string): string {
  const local = email.split("@")[0] ?? "";
  const name = local.split(".")[0] ?? local;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export default async function DashboardPage() {
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

  const firstName = extractFirstName(user!.email ?? "Usuario");
  const clinicName = clinic?.name ?? "tu clínica";

  const METRICS = [
    { label: "Conversaciones hoy", value: "—", delta: "vs. ayer —" },
    { label: "Citas hoy", value: "—", delta: "vs. ayer —" },
    { label: "Pendientes", value: "—", delta: "activas —" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Bienvenido, {firstName}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Aquí tienes el resumen de hoy en {clinicName}.
        </p>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-6">
        {METRICS.map((m) => (
          <Card
            key={m.label}
            className="rounded-xl border-stone-200 shadow-card transition-shadow hover:shadow-card-hero"
          >
            <CardContent className="p-6">
              <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
                {m.label}
              </p>
              <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-stone-900">
                {m.value}
              </p>
              <p className="mt-1 text-xs text-stone-400">{m.delta}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Clinic info */}
      <Card className="rounded-xl border-stone-200 shadow-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-stone-900">
            Tu clínica
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500">Nombre</span>
            <span className="font-medium text-stone-900">{clinicName}</span>
          </div>
          <div className="border-t border-stone-100" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500">Tu rol</span>
            <span className="font-medium text-stone-900">
              {ROLE_LABELS[clinicUser?.role ?? ""] ?? clinicUser?.role ?? "—"}
            </span>
          </div>
          <div className="border-t border-stone-100" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500">Estado</span>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
              Activa
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
