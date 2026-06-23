import { createClient } from "@/lib/supabase/server";
import { InfoRow, InfoSection } from "../_components/info-row";
import { ProfileForm } from "./profile-form";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  recepcion: "Recepción",
  veterinario: "Veterinario",
};

export default async function SettingsProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("role, created_at, display_name")
    .eq("user_id", user!.id)
    .maybeSingle();

  const cu = clinicUser as {
    role: string;
    created_at: string;
    display_name: string | null;
  } | null;

  const email = user?.email ?? "—";
  const displayName = cu?.display_name ?? null;

  return (
    <div className="space-y-5">
      {/* Editable profile card */}
      <ProfileForm displayName={displayName} email={email} />

      {/* Read-only account info */}
      <InfoSection title="Cuenta">
        <InfoRow label="Email" value={email} />
        <InfoRow
          label="Rol"
          value={ROLE_LABELS[cu?.role ?? ""] ?? cu?.role ?? "—"}
        />
        <InfoRow
          label="Miembro desde"
          value={
            cu?.created_at
              ? new Date(cu.created_at).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "—"
          }
        />
      </InfoSection>

      {/* Preferences (disabled, future) */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-stone-900">
            Preferencias
          </h3>
          <p className="mt-0.5 text-xs text-stone-400">
            Configuración disponible próximamente
          </p>
        </div>
        <div className="divide-y divide-stone-100">
          <div className="flex items-center justify-between py-2.5 text-sm">
            <span className="text-stone-500">Notificaciones por email</span>
            <button
              disabled
              className="inline-flex h-5 w-9 shrink-0 cursor-not-allowed items-center rounded-full border-2 border-transparent bg-stone-200 transition-colors"
            >
              <span className="inline-block size-4 translate-x-0.5 rounded-full bg-white shadow-sm" />
            </button>
          </div>
          <div className="flex items-center justify-between py-2.5 text-sm">
            <span className="text-stone-500">Modo oscuro</span>
            <button
              disabled
              className="inline-flex h-5 w-9 shrink-0 cursor-not-allowed items-center rounded-full border-2 border-transparent bg-stone-200 transition-colors"
            >
              <span className="inline-block size-4 translate-x-0.5 rounded-full bg-white shadow-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
