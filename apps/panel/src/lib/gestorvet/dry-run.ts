import type { Database } from "@recepia/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GestorVetRecord } from "./client";
import { readGestorVetClient } from "./discovery";

type AdminDb = SupabaseClient<Database>;
type DbJson = Database["public"]["Tables"]["clinic_integrations"]["Row"]["metadata"];

type FieldMap = Record<string, string | null>;

export type GestorVetDryRunReport = {
  status: "succeeded";
  completedAt: string;
  totalRecords: number;
  clients: {
    total: number;
    requiresDetailedRead: boolean;
    detailFields: string[];
    eligibleAfterReview: number;
    existingPhoneMatches: number;
    missingPhone: number;
    invalidPhone: number;
    missingName: number;
    duplicatePhoneGroups: number;
    duplicatePhoneRecords: number;
    fields: FieldMap;
  };
  pets: {
    total: number;
    requiresDetailedRead: boolean;
    detailFields: string[];
    eligibleAfterReview: number;
    existingMicrochipMatches: number;
    orphanOwner: number;
    missingName: number;
    missingSpecies: number;
    duplicateMicrochipGroups: number;
    fields: FieldMap;
  };
  appointments: {
    total: number;
    requiresDetailedRead: boolean;
    eligibleAfterMapping: number;
    orphanClient: number;
    orphanPet: number;
    unknownUser: number;
    unknownReason: number;
    missingDate: number;
    fields: FieldMap;
  };
  mappingsPending: {
    species: number;
    users: number;
    consultationReasons: number;
  };
};

const aliases = {
  client: {
    id: ["id", "cliente_id", "id_cliente", "client_id", "codigo_cliente"],
    name: ["nombre", "nombre_cliente", "razon_social", "contacto1", "name", "cliente"],
    phone: [
      "movil_contacto1",
      "telefono_movil",
      "movil",
      "tlf_contacto1",
      "telefono",
      "telefono1",
      "phone",
      "tel",
    ],
  },
  pet: {
    id: ["id", "mascota_id", "id_mascota", "pet_id"],
    clientId: ["cliente_id", "id_cliente", "client_id", "propietario_id", "cliente"],
    name: ["nombre", "nombre_mascota", "name", "mascota"],
    species: ["especie_id", "id_especie", "species_id", "especie"],
    microchip: ["chip_tatuaje", "microchip", "chip", "numero_chip"],
  },
  appointment: {
    clientId: ["cliente_id", "id_cliente", "client_id"],
    petId: ["mascota_id", "id_mascota", "pet_id"],
    userId: ["user_id", "usuario_id", "id_usuario", "veterinario_id"],
    reasonId: ["motivo_consulta_id", "id_motivo_consulta", "motivo_id", "servicio_id"],
    date: ["fecha", "fecha_cita", "fecha_inicio", "inicio", "starts_at", "fechahora"],
  },
  speciesId: ["id", "especie_id", "id_especie", "species_id", "codigo", "value"],
  userId: ["id", "user_id", "usuario_id", "id_usuario", "veterinario_id", "codigo"],
  reasonId: [
    "id",
    "motivo_consulta_id",
    "id_motivo_consulta",
    "motivo_id",
    "servicio_id",
    "codigo",
  ],
} as const;

function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizedKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function scalar(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const result = String(value).trim();
  return result && result !== "0" ? result : null;
}

function matchingField(record: GestorVetRecord, candidates: readonly string[]): string | null {
  const fields = Object.keys(record).map((field) => ({ field, normalized: normalizedKey(field) }));
  for (const candidate of candidates) {
    const normalizedCandidate = normalizedKey(candidate);
    const exact = fields.find((entry) => entry.normalized === normalizedCandidate);
    if (exact) return exact.field;
  }
  for (const candidate of candidates) {
    const normalizedCandidate = normalizedKey(candidate);
    if (normalizedCandidate.length < 4) continue;
    const partial = fields.find((entry) => entry.normalized.includes(normalizedCandidate));
    if (partial) return partial.field;
  }
  return null;
}

function fieldFor(records: GestorVetRecord[], candidates: readonly string[]): string | null {
  for (const record of records.slice(0, 100)) {
    const field = matchingField(record, candidates);
    if (field) return field;
  }
  return null;
}

function valueFor(record: GestorVetRecord, candidates: readonly string[]): string | null {
  for (const candidate of candidates) {
    const field = matchingField(record, [candidate]);
    const value = field ? scalar(record[field]) : null;
    if (value) return value;
  }
  return null;
}

function normalizedPhone(value: string | null): string | null {
  if (!value) return null;
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 9) digits = `34${digits}`;
  return digits.length >= 7 && digits.length <= 15 ? digits : null;
}

function normalizedMicrochip(value: string | null): string | null {
  if (!value) return null;
  const result = value.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return result.length >= 8 ? result : null;
}

function duplicateStats(values: Array<string | null>) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const duplicates = [...counts.values()].filter((count) => count > 1);
  return {
    groups: duplicates.length,
    records: duplicates.reduce((total, count) => total + count, 0),
    counts,
  };
}

async function localPhones(db: AdminDb, clinicId: string): Promise<Set<string>> {
  const result = new Set<string>();
  for (let from = 0; ; from += 1_000) {
    const { data, error } = await db
      .from("clients")
      .select("phone")
      .eq("clinic_id", clinicId)
      .is("deleted_at", null)
      .range(from, from + 999);
    if (error) throw new Error("No se pudieron comparar los clientes de Recepia");
    for (const row of data) {
      const phone = normalizedPhone(row.phone);
      if (phone) result.add(phone);
    }
    if (data.length < 1_000) return result;
  }
}

async function localMicrochips(db: AdminDb, clinicId: string): Promise<Set<string>> {
  const result = new Set<string>();
  for (let from = 0; ; from += 1_000) {
    const { data, error } = await db
      .from("pets")
      .select("microchip")
      .eq("clinic_id", clinicId)
      .is("deleted_at", null)
      .range(from, from + 999);
    if (error) throw new Error("No se pudieron comparar las mascotas de Recepia");
    for (const row of data) {
      const microchip = normalizedMicrochip(row.microchip);
      if (microchip) result.add(microchip);
    }
    if (data.length < 1_000) return result;
  }
}

function externalIds(records: GestorVetRecord[], candidates: readonly string[]): Set<string> {
  return new Set(
    records
      .map((record) => valueFor(record, candidates))
      .filter((value): value is string => value !== null),
  );
}

function allFields(records: GestorVetRecord[]): string[] {
  return [...new Set(records.flatMap((record) => Object.keys(record)))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export async function dryRunGestorVet(
  db: AdminDb,
  clinicId: string,
): Promise<GestorVetDryRunReport> {
  const { client, integration } = await readGestorVetClient(db, clinicId);
  const { data: run, error: runError } = await db
    .from("integration_sync_runs")
    .insert({
      clinic_id: clinicId,
      provider: "gestorvet",
      direction: "pull",
      resource: "dry_run",
      status: "running",
    })
    .select("id")
    .single();
  if (runError || !run) throw new Error("No se pudo iniciar el dry run de GestorVet");

  const [clients, pets, appointments, species, users, reasons, recepiaPhones, recepiaChips] =
    await Promise.all([
      client.getAllClients(1_000),
      client.getPets(),
      client.getAppointments(),
      client.getSpecies(),
      client.getUsers(),
      client.getConsultationReasons(),
      localPhones(db, clinicId),
      localMicrochips(db, clinicId),
    ]);

  const clientIds = externalIds(clients, aliases.client.id);
  const petIds = externalIds(pets, aliases.pet.id);
  const userIds = externalIds(users, aliases.userId);
  const reasonIds = externalIds(reasons, aliases.reasonId);
  const clientsRequireDetailedRead = fieldFor(clients, aliases.client.phone) === null;
  const petsRequireDetailedRead =
    fieldFor(pets, aliases.pet.clientId) === null || fieldFor(pets, aliases.pet.species) === null;
  const appointmentsRequireDetailedRead =
    fieldFor(appointments, aliases.appointment.clientId) === null ||
    fieldFor(appointments, aliases.appointment.petId) === null ||
    fieldFor(appointments, aliases.appointment.userId) === null ||
    fieldFor(appointments, aliases.appointment.reasonId) === null;

  const sampleClientId = clients[0] ? valueFor(clients[0], aliases.client.id) : null;
  const samplePetId = pets[0] ? valueFor(pets[0], aliases.pet.id) : null;
  const [sampleClientDetails, samplePetDetails] = await Promise.all([
    sampleClientId ? client.getClient(sampleClientId) : Promise.resolve([]),
    samplePetId ? client.getPet(samplePetId) : Promise.resolve([]),
  ]);

  const clientPhones = clients.map((record) =>
    normalizedPhone(valueFor(record, aliases.client.phone)),
  );
  const clientPhoneDuplicates = duplicateStats(clientPhones);
  const clientMissingRawPhone = clientsRequireDetailedRead
    ? 0
    : clients.filter((record) => valueFor(record, aliases.client.phone) === null).length;
  const clientInvalidPhone = clientsRequireDetailedRead
    ? 0
    : clients.filter((record) => {
        const raw = valueFor(record, aliases.client.phone);
        return raw !== null && normalizedPhone(raw) === null;
      }).length;
  const existingPhoneMatches = clientPhones.filter(
    (phone) => phone !== null && recepiaPhones.has(phone),
  ).length;
  const eligibleClients = clientsRequireDetailedRead
    ? 0
    : clientPhones.filter(
        (phone, index) =>
          phone !== null &&
          !recepiaPhones.has(phone) &&
          clientPhoneDuplicates.counts.get(phone) === 1 &&
          valueFor(clients[index] ?? {}, aliases.client.name) !== null,
      ).length;

  const petChips = pets.map((record) =>
    normalizedMicrochip(valueFor(record, aliases.pet.microchip)),
  );
  const petChipDuplicates = duplicateStats(petChips);
  const existingMicrochipMatches = petChips.filter(
    (chip) => chip !== null && recepiaChips.has(chip),
  ).length;
  const orphanOwner = petsRequireDetailedRead
    ? 0
    : pets.filter((record) => {
        const ownerId = valueFor(record, aliases.pet.clientId);
        return ownerId === null || !clientIds.has(ownerId);
      }).length;
  const eligiblePets = petsRequireDetailedRead
    ? 0
    : pets.filter((record, index) => {
        const ownerId = valueFor(record, aliases.pet.clientId);
        const chip = petChips[index] ?? null;
        return (
          ownerId !== null &&
          clientIds.has(ownerId) &&
          valueFor(record, aliases.pet.name) !== null &&
          valueFor(record, aliases.pet.species) !== null &&
          !(chip && recepiaChips.has(chip)) &&
          !(chip && (petChipDuplicates.counts.get(chip) ?? 0) > 1)
        );
      }).length;

  const orphanAppointmentClient = appointmentsRequireDetailedRead
    ? 0
    : appointments.filter((record) => {
        const id = valueFor(record, aliases.appointment.clientId);
        return id === null || !clientIds.has(id);
      }).length;
  const orphanAppointmentPet = appointmentsRequireDetailedRead
    ? 0
    : appointments.filter((record) => {
        const id = valueFor(record, aliases.appointment.petId);
        return id === null || !petIds.has(id);
      }).length;
  const unknownAppointmentUser = appointmentsRequireDetailedRead
    ? 0
    : appointments.filter((record) => {
        const id = valueFor(record, aliases.appointment.userId);
        return id === null || !userIds.has(id);
      }).length;
  const unknownAppointmentReason = appointmentsRequireDetailedRead
    ? 0
    : appointments.filter((record) => {
        const id = valueFor(record, aliases.appointment.reasonId);
        return id === null || !reasonIds.has(id);
      }).length;
  const missingAppointmentDate = appointments.filter(
    (record) => valueFor(record, aliases.appointment.date) === null,
  ).length;
  const eligibleAppointments = appointmentsRequireDetailedRead
    ? 0
    : appointments.filter((record) => {
        const clientId = valueFor(record, aliases.appointment.clientId);
        const petId = valueFor(record, aliases.appointment.petId);
        const userId = valueFor(record, aliases.appointment.userId);
        const reasonId = valueFor(record, aliases.appointment.reasonId);
        return (
          clientId !== null &&
          clientIds.has(clientId) &&
          petId !== null &&
          petIds.has(petId) &&
          userId !== null &&
          userIds.has(userId) &&
          reasonId !== null &&
          reasonIds.has(reasonId) &&
          valueFor(record, aliases.appointment.date) !== null
        );
      }).length;

  const completedAt = new Date().toISOString();
  const report: GestorVetDryRunReport = {
    status: "succeeded",
    completedAt,
    totalRecords: clients.length + pets.length + appointments.length,
    clients: {
      total: clients.length,
      requiresDetailedRead: clientsRequireDetailedRead,
      detailFields: allFields(sampleClientDetails),
      eligibleAfterReview: eligibleClients,
      existingPhoneMatches,
      missingPhone: clientMissingRawPhone,
      invalidPhone: clientInvalidPhone,
      missingName: clients.filter((record) => valueFor(record, aliases.client.name) === null)
        .length,
      duplicatePhoneGroups: clientPhoneDuplicates.groups,
      duplicatePhoneRecords: clientPhoneDuplicates.records,
      fields: {
        id: fieldFor(clients, aliases.client.id),
        name: fieldFor(clients, aliases.client.name),
        phone: fieldFor(clients, aliases.client.phone),
      },
    },
    pets: {
      total: pets.length,
      requiresDetailedRead: petsRequireDetailedRead,
      detailFields: allFields(samplePetDetails),
      eligibleAfterReview: eligiblePets,
      existingMicrochipMatches,
      orphanOwner,
      missingName: pets.filter((record) => valueFor(record, aliases.pet.name) === null).length,
      missingSpecies: pets.filter((record) => valueFor(record, aliases.pet.species) === null)
        .length,
      duplicateMicrochipGroups: petChipDuplicates.groups,
      fields: {
        id: fieldFor(pets, aliases.pet.id),
        clientId: fieldFor(pets, aliases.pet.clientId),
        name: fieldFor(pets, aliases.pet.name),
        species: fieldFor(pets, aliases.pet.species),
        microchip: fieldFor(pets, aliases.pet.microchip),
      },
    },
    appointments: {
      total: appointments.length,
      requiresDetailedRead: appointmentsRequireDetailedRead,
      eligibleAfterMapping: eligibleAppointments,
      orphanClient: orphanAppointmentClient,
      orphanPet: orphanAppointmentPet,
      unknownUser: unknownAppointmentUser,
      unknownReason: unknownAppointmentReason,
      missingDate: missingAppointmentDate,
      fields: {
        clientId: fieldFor(appointments, aliases.appointment.clientId),
        petId: fieldFor(appointments, aliases.appointment.petId),
        userId: fieldFor(appointments, aliases.appointment.userId),
        reasonId: fieldFor(appointments, aliases.appointment.reasonId),
        date: fieldFor(appointments, aliases.appointment.date),
      },
    },
    mappingsPending: {
      species: species.length,
      users: users.length,
      consultationReasons: reasons.length,
    },
  };

  const blockers =
    clientMissingRawPhone +
    clientInvalidPhone +
    orphanOwner +
    orphanAppointmentClient +
    orphanAppointmentPet;
  await db
    .from("integration_sync_runs")
    .update({
      status: "succeeded",
      cursor: report as unknown as DbJson,
      records_read: report.totalRecords,
      records_skipped: blockers,
      finished_at: completedAt,
    })
    .eq("id", run.id);

  const previousMetadata = objectValue(integration.metadata);
  const { error: metadataError } = await db
    .from("clinic_integrations")
    .update({
      metadata: {
        ...previousMetadata,
        dry_run_status: "succeeded",
        dry_run_completed_at: completedAt,
        dry_run: report,
      } as unknown as DbJson,
    })
    .eq("id", integration.id);
  if (metadataError) throw new Error("El dry run terminó, pero no pudo guardarse");

  return report;
}
