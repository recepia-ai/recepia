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

/**
 * Extracts a human-readable first name from an email address.
 *
 * Strategy:
 *   1. If local part contains a dot → first segment before dot → "Juan"
 *   2. If local part has no dot and no uppercase letters:
 *      - If the resulting letters are ≤9 chars → plausible single name. Keep it.
 *      - If longer than 9 chars → likely concatenation (e.g. marcsolerroldan).
 *        Truncate to first 4 chars as an approximate first name.
 *   3. Fallback: "Hola" (no name) if we can't extract confidently.
 *
 * Examples:
 *   "marc.soler@example.com"   → "Marc"
 *   "alejandro@gmail.com"      → "Alejandro"   (9 chars, preserved)
 *   "marcsolerroldan85@..."    → "Marc"        (concatenation detected)
 *   "j.doe@..."                → "J" → below threshold → "Hola"
 *   "@..."                     → "Hola"
 */
function extractFirstName(email: string): string {
  const local = email.split("@")[0] ?? "";

  // If the local part has a dot, take the first segment.
  const candidate = local.includes(".")
    ? (local.split(".")[0] ?? local)
    : local;

  // Strip leading non-letters, then take contiguous letters.
  const letters = candidate.match(/[a-zA-Z]+/)?.[0] ?? "";

  if (letters.length < 2) return "";

  // If the local part has a dot, the first segment is very likely a name.
  if (local.includes(".")) {
    return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
  }

  // No dot, no mixed-case → ambiguous. Long runs are likely concatenations.
  const hasUppercase = /[A-Z]/.test(letters);
  if (!hasUppercase && letters.length > 9) {
    // Truncate to first 4 chars — best guess at first name.
    return letters.slice(0, 4).charAt(0).toUpperCase() + letters.slice(1, 4).toLowerCase();
  }

  return letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase();
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
          {firstName ? `Bienvenido, ${firstName}` : "Bienvenido"}
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
