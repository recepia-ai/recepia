import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ClinicSummary = {
  name: string | null;
  slug: string | null;
};

type ClinicUserRow = {
  role: string;
  clinic_id: string;
  clinics: ClinicSummary | ClinicSummary[] | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await supabase
    .from("clinic_users")
    .select("role, clinic_id, clinics(name, slug)")
    .eq("user_id", user!.id)
    .maybeSingle();

  const clinicError = result.error;
  const clinicUser = result.data as ClinicUserRow | null;

  const clinic = clinicUser
    ? Array.isArray(clinicUser.clinics)
      ? clinicUser.clinics[0] ?? null
      : clinicUser.clinics
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Bienvenido al panel de Recepia.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tu clínica</CardTitle>
        </CardHeader>
        <CardContent>
          {clinicError && (
            <p className="text-sm text-red-700">
              Error al cargar la clínica: {clinicError.message}
            </p>
          )}
          {!clinicError && clinicUser && (
            <div className="space-y-1.5 text-sm text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Nombre</span>
                <span className="font-medium">{clinic?.name ?? "Sin nombre"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Slug</span>
                <span className="font-medium">{clinic?.slug ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tu rol</span>
                <span className="font-medium">{clinicUser.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Clinic ID</span>
                <code className="text-xs text-slate-400">
                  {clinicUser.clinic_id}
                </code>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Debug panel — will be removed before E7 close */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Datos del usuario (debug)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-64 overflow-auto rounded bg-slate-100 p-3 text-xs text-slate-600">
            {JSON.stringify(user, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
