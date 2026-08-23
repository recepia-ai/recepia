import { createAdminClient } from "@/lib/supabase/admin";
import {
  GestorVetApiError,
  GestorVetClient,
  type GestorVetJson,
  type GestorVetRecord,
} from "./client";

type OutboxJob = {
  id: string;
  clinic_id: string;
  entity_type: "client" | "pet" | "appointment";
  entity_id: string;
  operation: "create" | "update";
  attempts: number;
};

type GestorVetIntegrationMetadata = {
  defaults?: {
    center_id?: string | number;
    location_id?: string | number;
    creator_user_id?: string | number;
  };
  species_ids?: Record<string, string | number>;
};

type JsonObject = Record<string, unknown>;

type AdminDb = ReturnType<typeof createAdminClient>;

class BlockedSyncError extends Error {}
class DeferredSyncError extends Error {}

function objectValue(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function nestedObject(value: unknown, key: string): JsonObject {
  return objectValue(objectValue(value)[key]);
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
}

function valueByAliases(record: GestorVetRecord, aliases: string[]): unknown {
  const keys = new Map(Object.keys(record).map((key) => [key.toLowerCase(), key]));
  for (const alias of aliases) {
    const actual = keys.get(alias.toLowerCase());
    if (actual) return record[actual];
  }
  return undefined;
}

export function externalIdFromGestorVet(payload: GestorVetJson): string | null {
  const queue: GestorVetJson[] = [payload];
  const aliases = ["id", "cliente_id", "mascota_id", "cita_id", "agenda_id", "insert_id"];

  while (queue.length > 0) {
    const current = queue.shift();
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    if (current === null || typeof current !== "object") continue;

    const record = current as GestorVetRecord;
    const candidate = valueByAliases(record, aliases);
    const normalized = optionalString(candidate);
    if (normalized && /^\d+$/.test(normalized)) return normalized;
    queue.push(...Object.values(record));
  }

  return null;
}

async function externalIdFor(
  db: AdminDb,
  clinicId: string,
  entityType: string,
  localId: string,
): Promise<string | null> {
  const { data, error } = await db
    .from("integration_external_links")
    .select("external_id")
    .eq("clinic_id", clinicId)
    .eq("provider", "gestorvet")
    .eq("entity_type", entityType)
    .eq("local_id", localId)
    .maybeSingle();

  if (error) throw new Error("Could not read GestorVet external link");
  return optionalString(data?.external_id) ?? null;
}

async function saveExternalId(db: AdminDb, job: OutboxJob, externalId: string): Promise<void> {
  const { data: existing } = await db
    .from("integration_external_links")
    .select("id")
    .eq("clinic_id", job.clinic_id)
    .eq("provider", "gestorvet")
    .eq("entity_type", job.entity_type)
    .eq("local_id", job.entity_id)
    .maybeSingle();

  const query = existing?.id
    ? db
        .from("integration_external_links")
        .update({ external_id: externalId, last_seen_at: new Date().toISOString() })
        .eq("id", existing.id)
    : db.from("integration_external_links").insert({
        clinic_id: job.clinic_id,
        provider: "gestorvet",
        entity_type: job.entity_type,
        local_id: job.entity_id,
        external_id: externalId,
        last_seen_at: new Date().toISOString(),
      });

  const { error } = await query;
  if (error) throw new Error("Could not save GestorVet external link");
}

async function loadClient(db: AdminDb, job: OutboxJob) {
  const { data, error } = await db
    .from("clients")
    .select("id, name, phone, email, notes, metadata, deleted_at")
    .eq("id", job.entity_id)
    .eq("clinic_id", job.clinic_id)
    .maybeSingle();
  if (error || !data) throw new BlockedSyncError("Client no longer exists in Recepia");
  return data as {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    notes: string | null;
    metadata: unknown;
    deleted_at: string | null;
  };
}

async function pushClient(db: AdminDb, client: GestorVetClient, job: OutboxJob) {
  const row = await loadClient(db, job);
  const gestorVet = nestedObject(row.metadata, "gestorvet");
  const address = nestedObject(gestorVet, "address");
  const write = {
    name: row.name,
    taxId: optionalString(gestorVet.tax_id),
    statusId: row.deleted_at ? (2 as const) : (1 as const),
    address: optionalString(address.street),
    postalCode: optionalString(address.postal_code),
    populationId: optionalString(address.population_id),
    provinceId: optionalString(address.province_id),
    clientGroupId: optionalString(gestorVet.client_group_id),
    notes: row.notes ?? undefined,
    contactName: row.name,
    mobile: row.phone,
    email: row.email ?? undefined,
    noEmail: !row.email,
    createVerified: true,
  };

  const currentExternalId = await externalIdFor(db, job.clinic_id, "client", job.entity_id);
  if (job.operation === "update" && !currentExternalId) {
    throw new DeferredSyncError("Client create has not produced a GestorVet external ID yet");
  }
  const response = currentExternalId
    ? await client.updateClient(currentExternalId, write)
    : await client.createClient(write);

  if (!currentExternalId) {
    const createdId = externalIdFromGestorVet(response);
    if (!createdId) {
      throw new BlockedSyncError(
        "GestorVet accepted the client but did not return a detectable external ID",
      );
    }
    await saveExternalId(db, job, createdId);
  }
}

async function pushPet(
  db: AdminDb,
  client: GestorVetClient,
  job: OutboxJob,
  metadata: GestorVetIntegrationMetadata,
) {
  if (job.operation !== "create") {
    throw new BlockedSyncError("GestorVet does not document pet updates");
  }

  const { data: row, error } = await db
    .from("pets")
    .select(
      "id, client_id, name, species, breed, birth_date, sex, microchip, notes, metadata, active",
    )
    .eq("id", job.entity_id)
    .eq("clinic_id", job.clinic_id)
    .maybeSingle();
  if (error || !row) throw new BlockedSyncError("Pet no longer exists in Recepia");

  const ownerExternalId = await externalIdFor(db, job.clinic_id, "client", row.client_id);
  if (!ownerExternalId) {
    throw new DeferredSyncError("Pet owner has no GestorVet external ID yet");
  }

  const gestorVet = nestedObject(row.metadata, "gestorvet");
  const speciesId = metadata.species_ids?.[row.species];
  if (speciesId === undefined) {
    throw new BlockedSyncError(`No GestorVet species mapping for ${row.species}`);
  }

  const response = await client.createPet({
    clientId: ownerExternalId,
    medicalRecordNumber: optionalString(gestorVet.medical_record_number),
    status: row.active ? 1 : 2,
    name: row.name,
    microchip: row.microchip ?? undefined,
    passport: optionalString(gestorVet.passport),
    sexId: row.sex === "male" ? 3 : row.sex === "female" ? 4 : undefined,
    birthDate: row.birth_date ?? undefined,
    speciesId,
    breedId: optionalString(gestorVet.breed_id),
    temperamentId: optionalString(gestorVet.temperament_id),
    affinityDegree:
      typeof gestorVet.affinity_degree === "number" ? gestorVet.affinity_degree : undefined,
    neutered: gestorVet.neutered === true,
    coat: optionalString(gestorVet.coat),
    habitat: optionalString(gestorVet.habitat),
    usualVetId: optionalString(gestorVet.usual_vet_id),
    notes: row.notes ?? undefined,
    clinicalIncompatibilities: optionalString(gestorVet.clinical_incompatibilities),
  });

  const createdId = externalIdFromGestorVet(response);
  if (!createdId) {
    throw new BlockedSyncError(
      "GestorVet accepted the pet but did not return a detectable external ID",
    );
  }
  await saveExternalId(db, job, createdId);
}

function madridDateTime(iso: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`,
  };
}

async function pushAppointment(
  db: AdminDb,
  client: GestorVetClient,
  job: OutboxJob,
  metadata: GestorVetIntegrationMetadata,
) {
  if (job.operation !== "create") {
    throw new BlockedSyncError("GestorVet does not document appointment updates");
  }

  const { data: row, error } = await db
    .from("appointments")
    .select("id, client_id, pet_id, vet_user_id, service_id, starts_at, notes, status")
    .eq("id", job.entity_id)
    .eq("clinic_id", job.clinic_id)
    .maybeSingle();
  if (error || !row) {
    throw new BlockedSyncError("Appointment no longer exists in Recepia");
  }
  if (row.status === "cancelled") {
    throw new BlockedSyncError("Appointment was cancelled before GestorVet sync");
  }
  if (!row.pet_id || !row.vet_user_id || !row.service_id) {
    throw new BlockedSyncError(
      "Appointment requires a pet, veterinarian and service before GestorVet sync",
    );
  }

  const [clientId, petId, vetId, reasonId] = await Promise.all([
    externalIdFor(db, job.clinic_id, "client", row.client_id),
    externalIdFor(db, job.clinic_id, "pet", row.pet_id),
    externalIdFor(db, job.clinic_id, "clinic_user", row.vet_user_id),
    externalIdFor(db, job.clinic_id, "consultation_reason", row.service_id),
  ]);
  if (!clientId || !petId) {
    throw new DeferredSyncError("Appointment client or pet has no GestorVet external ID yet");
  }
  if (!vetId || !reasonId) {
    throw new BlockedSyncError("Appointment requires mapped veterinarian and consultation reason");
  }

  const creatorId = metadata.defaults?.creator_user_id ?? vetId;
  const when = madridDateTime(row.starts_at);
  const response = await client.createAppointment({
    clientId,
    petId,
    consultationReasonId: reasonId,
    date: when.date,
    time: when.time,
    description: row.notes ?? undefined,
    creatorUserId: creatorId,
    assignedUserId: vetId,
    centerId: metadata.defaults?.center_id ?? 0,
    locationId: metadata.defaults?.location_id ?? 0,
  });

  const createdId = externalIdFromGestorVet(response);
  if (createdId) {
    await saveExternalId(db, job, createdId);
  }
}

async function credentialsForClinic(db: AdminDb, clinicId: string) {
  const { data: integration, error } = await db
    .from("clinic_integrations")
    .select("vault_secret_id, metadata")
    .eq("clinic_id", clinicId)
    .eq("provider", "gestorvet")
    .maybeSingle();
  if (error || !integration) throw new BlockedSyncError("GestorVet integration is missing");

  const integrationMetadata = objectValue(integration.metadata);
  if (integrationMetadata.sync_enabled !== true) {
    throw new BlockedSyncError("GestorVet synchronization is paused");
  }

  const { data: rawSecret, error: secretError } = await db.rpc("vault_read_secret", {
    p_id: integration.vault_secret_id,
  });
  if (secretError || typeof rawSecret !== "string") {
    throw new BlockedSyncError("GestorVet credentials could not be read");
  }

  try {
    const parsed = JSON.parse(rawSecret) as { apiKey?: string; noc?: string };
    if (!parsed.apiKey || !parsed.noc) throw new Error("invalid secret");
    return {
      client: new GestorVetClient({ apiKey: parsed.apiKey, noc: parsed.noc }),
      metadata: integrationMetadata as GestorVetIntegrationMetadata,
    };
  } catch {
    throw new BlockedSyncError("GestorVet Vault secret has an invalid shape");
  }
}

async function markSucceeded(db: AdminDb, jobId: string) {
  await db
    .from("integration_outbox")
    .update({
      status: "succeeded",
      processed_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
    })
    .eq("id", jobId);
}

async function markBlocked(db: AdminDb, jobId: string, message: string) {
  await db
    .from("integration_outbox")
    .update({ status: "blocked", last_error: message, locked_at: null, locked_by: null })
    .eq("id", jobId);
}

async function markFailed(db: AdminDb, job: OutboxJob, message: string) {
  const delayMinutes = Math.min(2 ** Math.max(job.attempts - 1, 0), 360);
  await db
    .from("integration_outbox")
    .update({
      status: "failed",
      last_error: message,
      next_attempt_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
      locked_at: null,
      locked_by: null,
    })
    .eq("id", job.id);
}

export async function processGestorVetOutbox(options?: {
  limit?: number;
  workerId?: string;
}): Promise<{ claimed: number; succeeded: number; failed: number; blocked: number }> {
  const db = createAdminClient();
  const workerId = options?.workerId ?? `gestorvet-${crypto.randomUUID()}`;
  const { data, error } = await db.rpc("claim_integration_outbox", {
    p_provider: "gestorvet",
    p_worker_id: workerId,
    p_limit: options?.limit ?? 25,
  });
  if (error) throw new Error("Could not claim GestorVet outbox jobs");

  const jobs = (data ?? []) as OutboxJob[];
  const result = { claimed: jobs.length, succeeded: 0, failed: 0, blocked: 0 };
  const integrations = new Map<string, Awaited<ReturnType<typeof credentialsForClinic>>>();

  for (const job of jobs) {
    try {
      let integration = integrations.get(job.clinic_id);
      if (!integration) {
        integration = await credentialsForClinic(db, job.clinic_id);
        integrations.set(job.clinic_id, integration);
      }

      if (job.entity_type === "client") {
        await pushClient(db, integration.client, job);
      } else if (job.entity_type === "pet") {
        await pushPet(db, integration.client, job, integration.metadata);
      } else {
        await pushAppointment(db, integration.client, job, integration.metadata);
      }

      await markSucceeded(db, job.id);
      result.succeeded += 1;
    } catch (syncError) {
      const safeMessage =
        syncError instanceof Error ? syncError.message : "Unexpected GestorVet sync failure";
      if (syncError instanceof BlockedSyncError) {
        await markBlocked(db, job.id, safeMessage);
        result.blocked += 1;
      } else {
        const retryMessage =
          syncError instanceof GestorVetApiError
            ? `${syncError.message} (${syncError.endpoint})`
            : safeMessage;
        await markFailed(db, job, retryMessage);
        result.failed += 1;
      }
    }
  }

  return result;
}
