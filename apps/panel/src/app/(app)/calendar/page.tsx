import { createClient } from "@/lib/supabase/server";
import { CalendarClient } from "./_components/calendar-client";
import type { AppointmentWithDetails, BusinessHours } from "./_components/types";
import type { Database } from "@recepia/db";

type ApptRow = Database["public"]["Tables"]["appointments"]["Row"] & {
  clients: { name: string; phone: string } | { name: string; phone: string }[] | null;
  pets: { name: string; species: Database["public"]["Enums"]["pet_species"] } | { name: string; species: Database["public"]["Enums"]["pet_species"] }[] | null;
  services: { name: string; duration_minutes: number } | { name: string; duration_minutes: number }[] | null;
};

export default async function CalendarPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch appointments with joins for the date window
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 7);
  const to = new Date(today);
  to.setDate(to.getDate() + 60);

  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, ends_at, status, notes, clients(name, phone), pets(name, species), services(name, duration_minutes)",
    )
    .gte("starts_at", from.toISOString())
    .lte("starts_at", to.toISOString())
    .order("starts_at", { ascending: true });

  // Fetch clinic config for business hours
  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinic_id, clinics(name, slug)")
    .eq("user_id", user!.id)
    .maybeSingle();

  const cu = clinicUser as {
    clinic_id: string;
    clinics: { name: string; slug: string } | { name: string; slug: string }[] | null;
  } | null;

  const clinic = cu
    ? Array.isArray(cu.clinics)
      ? cu.clinics[0] ?? null
      : cu.clinics
    : null;

  const clinicName = clinic?.name ?? "tu clínica";

  // Fetch business hours from clinic_config
  let businessHours: BusinessHours | null = null;
  if (cu?.clinic_id) {
    const { data: config } = await supabase
      .from("clinic_config")
      .select("config")
      .eq("clinic_id", cu.clinic_id)
      .maybeSingle();

    const cc = config as { config: Record<string, unknown> } | null;
    const hours = cc?.config as Record<string, unknown> | null;
    if (hours?.["hours"] && typeof hours["hours"] === "object") {
      const h = hours["hours"] as Record<string, unknown>;
      // The seed uses "general" inside "hours"
      const general = (h["general"] as Record<string, { start: string; end: string }[]>) ?? null;
      businessHours = general;
    }
  }

  // Transform appointments
  const rows: AppointmentWithDetails[] = (appointments ?? []).map((a) => {
    const row = a as ApptRow;
    const client = row.clients
      ? Array.isArray(row.clients)
        ? row.clients[0] ?? null
        : row.clients
      : null;
    const pet = row.pets
      ? Array.isArray(row.pets)
        ? row.pets[0] ?? null
        : row.pets
      : null;
    const service = row.services
      ? Array.isArray(row.services)
        ? row.services[0] ?? null
        : row.services
      : null;

    return {
      id: row.id,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      status: row.status,
      notes: row.notes,
      client_name: client?.name ?? null,
      client_phone: client?.phone ?? null,
      pet_name: pet?.name ?? null,
      pet_species: pet?.species ?? null,
      service_name: service?.name ?? null,
      service_duration_minutes: service?.duration_minutes ?? null,
    };
  });

  return (
    <CalendarClient
      appointments={rows}
      businessHours={businessHours}
      clinicName={clinicName}
    />
  );
}
