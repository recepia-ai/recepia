import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

type ClinicSummary = {
  name: string | null
  slug: string | null
}

type ClinicUserRow = {
  role: string
  clinic_id: string
  clinics: ClinicSummary | ClinicSummary[] | null
}

export default async function Home() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Belt-and-suspenders: middleware protege la ruta, pero TS no lo sabe.
  if (!user) {
    redirect("/login")
  }

  const result = await supabase
    .from("clinic_users")
    .select("role, clinic_id, clinics(name, slug)")
    .eq("user_id", user.id)
    .maybeSingle()

  const clinicError = result.error
  const clinicUser = result.data as ClinicUserRow | null

  const clinic = clinicUser
    ? Array.isArray(clinicUser.clinics)
      ? clinicUser.clinics[0] ?? null
      : clinicUser.clinics
    : null

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Recepia</h1>
          <p className="text-slate-600">
            Sesión iniciada como <strong>{user.email}</strong>
          </p>
        </div>

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Tu clínica</h2>
          {clinicError && (
            <p className="mt-2 text-sm text-red-700">
              Error al cargar la clínica: {clinicError.message}
            </p>
          )}
          {!clinicError && !clinicUser && (
            <p className="mt-2 text-sm text-amber-700">
              Tu usuario no está vinculado a ninguna clínica todavía.
            </p>
          )}
          {clinicUser && (
            <div className="mt-3 space-y-1 text-slate-700">
              <p>
                <strong>Nombre:</strong> {clinic?.name ?? "Sin nombre"}
              </p>
              <p>
                <strong>Slug:</strong> {clinic?.slug ?? "—"}
              </p>
              <p>
                <strong>Rol:</strong> {clinicUser.role}
              </p>
              <p className="font-mono text-xs text-slate-500">
                ID: {clinicUser.clinic_id}
              </p>
            </div>
          )}
        </div>

        <details className="rounded-lg border bg-white p-4 text-sm text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-900">
            Datos completos del usuario (debug)
          </summary>
          <pre className="mt-3 overflow-auto rounded bg-slate-100 p-3 text-xs">
            {JSON.stringify(user, null, 2)}
          </pre>
        </details>
      </div>
    </main>
  )
}
