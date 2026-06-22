import { createClient } from "@/lib/supabase/server";
import { InfoRow, InfoSection } from "../_components/info-row";

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  trial: "Prueba",
  suspended: "Suspendida",
  inactive: "Inactiva",
};

function localeLabel(locale: string): string {
  if (locale === "es") return "Español";
  if (locale === "en") return "Inglés";
  if (locale === "ca") return "Catalán";
  return locale;
}

function timezoneLabel(tz: string): string {
  // Map common tz identifiers to friendly names
  const map: Record<string, string> = {
    "Europe/Madrid": "Europe/Madrid (CET/CEST)",
    "Atlantic/Canary": "Atlantic/Canary (WET/WEST)",
    "Europe/London": "Europe/London (GMT/BST)",
    "America/Mexico_City": "America/Mexico City (CST/CDT)",
    "America/Bogota": "America/Bogota (COT)",
    "America/Lima": "America/Lima (PET)",
    "America/Santiago": "America/Santiago (CLT/CLST)",
    "America/Buenos_Aires": "America/Buenos Aires (ART)",
  };
  return map[tz] ?? tz;
}

type ClinicRow = {
  name: string;
  slug: string;
  locale: string;
  timezone: string;
  status: string;
  created_at: string;
};

export default async function SettingsClinicPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinic_id, clinics(name, slug, locale, timezone, status, created_at)")
    .eq("user_id", user!.id)
    .maybeSingle();

  const cu = clinicUser as {
    clinic_id: string;
    clinics: ClinicRow | ClinicRow[] | null;
  } | null;

  const clinic = cu
    ? Array.isArray(cu.clinics)
      ? cu.clinics[0] ?? null
      : cu.clinics
    : null;

  if (!clinic) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 px-6 py-12 text-center">
        <p className="text-sm text-stone-500">
          No se pudo cargar la información de la clínica.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <InfoSection title="Información general">
        <InfoRow label="Nombre comercial" value={clinic.name} />
        <InfoRow label="Slug" value={clinic.slug} />
        <InfoRow
          label="CIF/NIF"
          value="—"
        />
        <InfoRow
          label="Dirección"
          value="—"
        />
        <InfoRow
          label="Email"
          value="—"
        />
        <InfoRow
          label="Teléfono"
          value="—"
        />
        <InfoRow
          label="Estado"
          value={STATUS_LABELS[clinic.status] ?? clinic.status}
        />
        <InfoRow
          label="Creada"
          value={new Date(clinic.created_at).toLocaleDateString("es-ES", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        />
      </InfoSection>

      <InfoSection title="Configuración">
        <InfoRow
          label="Idioma por defecto"
          value={localeLabel(clinic.locale)}
        />
        <InfoRow
          label="Zona horaria"
          value={timezoneLabel(clinic.timezone)}
        />
        <InfoRow label="Moneda" value="EUR (€)" />
      </InfoSection>
    </div>
  );
}
