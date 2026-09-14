import type { Database } from "@recepia/db";
import { notFound } from "next/navigation";
import { readGestorVetClient } from "@/lib/gestorvet/discovery";
import { gestorVetAppointment } from "@/lib/gestorvet/native-adapters";
import { resolveOrganizationContext } from "@/lib/organization-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CalendarClient } from "./_components/calendar-client";
import type { AppointmentWithDetails, BusinessHours } from "./_components/types";

export const maxDuration = 30;

type ApptRow = Database["public"]["Tables"]["appointments"]["Row"] & {
  clients: { name: string; phone: string } | { name: string; phone: string }[] | null;
  pets: { name: string; species: string } | { name: string; species: string }[] | null;
  services:
    | { name: string; duration_minutes: number }
    | { name: string; duration_minutes: number }[]
    | null;
};

export default async function CalendarPage() {
  const supabase = await createClient();
  const organizationResult = await resolveOrganizationContext(supabase);
  if (!organizationResult.ok) notFound();
  const clinicId = organizationResult.context.organization.id;
  const clinicName = organizationResult.context.organization.name;

  // Fetch appointments with joins for the date window
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 7);
  const to = new Date(today);
  to.setDate(to.getDate() + 60);

  const { data: appointments, error: apptError } = await supabase
    .from("appointments")
    .select(
      "id, starts_at, ends_at, status, notes, vet_user_id, clients(name, phone), pets(name, species), services(name, duration_minutes)",
    )
    .eq("clinic_id", clinicId)
    .gte("starts_at", from.toISOString())
    .lte("starts_at", to.toISOString())
    .order("starts_at", { ascending: true });

  if (apptError) {
    throw new Error(`Failed to fetch appointments: ${apptError.message}`);
  }

  const [vetsResult, clientsResult, petsResult, servicesResult, vetLinksResult] = await Promise.all(
    [
      supabase
        .from("clinic_users")
        .select("id, display_name")
        .eq("clinic_id", clinicId)
        .eq("staff_type", "vet")
        .order("display_name", { ascending: true }),
      supabase
        .from("clients")
        .select("id, name, phone")
        .eq("clinic_id", clinicId)
        .is("deleted_at", null)
        .order("name", { ascending: true })
        .limit(500),
      supabase
        .from("pets")
        .select("id, client_id, name")
        .eq("clinic_id", clinicId)
        .eq("active", true)
        .is("deleted_at", null)
        .order("name", { ascending: true })
        .limit(1000),
      supabase
        .from("services")
        .select("id, name, duration_minutes")
        .eq("clinic_id", clinicId)
        .eq("active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("integration_external_links")
        .select("external_id, local_id")
        .eq("clinic_id", clinicId)
        .eq("provider", "gestorvet")
        .eq("entity_type", "clinic_user"),
    ],
  );

  const vets = (vetsResult.data ?? []).map((vet) => ({
    id: vet.id,
    name: vet.display_name ?? "Veterinario sin nombre",
  }));
  const vetNameById = new Map(vets.map((vet) => [vet.id, vet.name]));
  const localVetIdByExternalId = new Map(
    (vetLinksResult.data ?? []).map((link) => [link.external_id, link.local_id]),
  );

  // Fetch business hours from clinic_config
  let businessHours: BusinessHours | null = null;
  {
    const { data: config } = await supabase
      .from("clinic_config")
      .select("config")
      .eq("clinic_id", clinicId)
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
        ? (row.clients[0] ?? null)
        : row.clients
      : null;
    const pet = row.pets ? (Array.isArray(row.pets) ? (row.pets[0] ?? null) : row.pets) : null;
    const service = row.services
      ? Array.isArray(row.services)
        ? (row.services[0] ?? null)
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
      vet_user_id: row.vet_user_id,
      vet_name: row.vet_user_id ? (vetNameById.get(row.vet_user_id) ?? "Veterinario") : null,
      source: "recepia",
      external_id: null,
    };
  });

  let gestorVetRows: AppointmentWithDetails[] = [];
  let gestorVetConnected = false;
  {
    try {
      const { client } = await readGestorVetClient(createAdminClient(), clinicId);
      const records = await client.getAppointments();
      gestorVetConnected = true;
      gestorVetRows = records.flatMap((record) => {
        const appointment = gestorVetAppointment(record);
        if (!appointment) return [];
        const startsAt = new Date(appointment.startsAt);
        if (startsAt < from || startsAt > to) return [];
        const localVetId = appointment.vetExternalId
          ? (localVetIdByExternalId.get(appointment.vetExternalId) ?? null)
          : null;
        return [
          {
            id: `gestorvet-${appointment.externalId}`,
            starts_at: appointment.startsAt,
            ends_at: appointment.endsAt,
            status: "scheduled",
            notes: appointment.notes,
            client_name: appointment.clientName,
            client_phone: null,
            pet_name: appointment.petName,
            pet_species: null,
            service_name: appointment.serviceName,
            service_duration_minutes: appointment.durationMinutes,
            vet_user_id: localVetId,
            vet_name: localVetId ? (vetNameById.get(localVetId) ?? "Veterinario") : null,
            source: "gestorvet" as const,
            external_id: appointment.externalId,
          },
        ];
      });
    } catch {
      // Keep the native calendar available during a GestorVet outage.
    }
  }

  const combinedRows = [...rows, ...gestorVetRows].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );

  return (
    <CalendarClient
      appointments={combinedRows}
      businessHours={businessHours}
      clinicName={clinicName}
      gestorVetConnected={gestorVetConnected}
      gestorVetCount={gestorVetRows.length}
      vets={vets}
      clients={(clientsResult.data ?? []).map((client) => ({
        id: client.id,
        name: client.name,
        phone: client.phone,
      }))}
      pets={(petsResult.data ?? []).map((pet) => ({
        id: pet.id,
        client_id: pet.client_id,
        name: pet.name,
      }))}
      services={(servicesResult.data ?? []).map((service) => ({
        id: service.id,
        name: service.name,
        duration_minutes: service.duration_minutes,
      }))}
    />
  );
}
