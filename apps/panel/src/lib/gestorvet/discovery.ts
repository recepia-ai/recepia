import type { Database } from "@recepia/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GestorVetClient, type GestorVetRecord } from "./client";

type AdminDb = SupabaseClient<Database>;
type DbJson = Database["public"]["Tables"]["clinic_integrations"]["Row"]["metadata"];

export type GestorVetDiscoveryResource = {
  resource: string;
  count: number | null;
  fields: string[];
  status: "succeeded" | "failed";
};

export type GestorVetDiscoveryReport = {
  status: "succeeded" | "partial" | "failed";
  completedAt: string;
  totalRecords: number;
  resources: GestorVetDiscoveryResource[];
};

function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function fieldNames(records: GestorVetRecord[]): string[] {
  const fields = new Set<string>();
  for (const record of records.slice(0, 25)) {
    for (const key of Object.keys(record)) fields.add(key);
  }
  return [...fields].sort((a, b) => a.localeCompare(b));
}

export async function readGestorVetClient(db: AdminDb, clinicId: string) {
  const { data: integration, error } = await db
    .from("clinic_integrations")
    .select("id, vault_secret_id, metadata")
    .eq("clinic_id", clinicId)
    .eq("provider", "gestorvet")
    .maybeSingle();
  if (error || !integration?.vault_secret_id) {
    throw new Error("La integración de GestorVet no está conectada");
  }

  const { data: rawSecret, error: secretError } = await db.rpc("vault_read_secret", {
    p_id: integration.vault_secret_id,
  });
  if (secretError || typeof rawSecret !== "string") {
    throw new Error("No se pudieron leer las credenciales de GestorVet");
  }

  try {
    const secret = JSON.parse(rawSecret) as { apiKey?: string; noc?: string };
    if (!secret.apiKey || !secret.noc) throw new Error("invalid secret");
    return {
      client: new GestorVetClient({ apiKey: secret.apiKey, noc: secret.noc }),
      integration,
    };
  } catch {
    throw new Error("Las credenciales guardadas de GestorVet no son válidas");
  }
}

export async function discoverGestorVet(
  db: AdminDb,
  clinicId: string,
): Promise<GestorVetDiscoveryReport> {
  const { client, integration } = await readGestorVetClient(db, clinicId);
  const { data: run, error: runError } = await db
    .from("integration_sync_runs")
    .insert({
      clinic_id: clinicId,
      provider: "gestorvet",
      direction: "pull",
      resource: "discovery",
      status: "running",
    })
    .select("id")
    .single();
  if (runError || !run) throw new Error("No se pudo iniciar el inventario de GestorVet");

  const readers: Array<{
    resource: string;
    read: () => Promise<GestorVetRecord[]>;
  }> = [
    { resource: "clinic", read: () => client.getClinicData() },
    { resource: "clients", read: () => client.getAllClients(1_000) },
    { resource: "pets", read: () => client.getPets() },
    { resource: "appointments", read: () => client.getAppointments() },
    { resource: "species", read: () => client.getSpecies() },
    { resource: "breeds", read: () => client.getBreeds() },
    { resource: "users", read: () => client.getUsers() },
    { resource: "consultation_reasons", read: () => client.getConsultationReasons() },
    { resource: "centers", read: () => client.getCenters() },
    { resource: "locations", read: () => client.getLocations() },
  ];

  const resources: GestorVetDiscoveryResource[] = [];
  for (let index = 0; index < readers.length; index += 3) {
    const batch = readers.slice(index, index + 3);
    const results = await Promise.allSettled(batch.map((entry) => entry.read()));
    results.forEach((result, resultIndex) => {
      const resource = batch[resultIndex]?.resource ?? "unknown";
      resources.push(
        result.status === "fulfilled"
          ? {
              resource,
              count: result.value.length,
              fields: fieldNames(result.value),
              status: "succeeded",
            }
          : { resource, count: null, fields: [], status: "failed" },
      );
    });
  }

  const succeeded = resources.filter((item) => item.status === "succeeded");
  const failed = resources.length - succeeded.length;
  const status = failed === 0 ? "succeeded" : succeeded.length === 0 ? "failed" : "partial";
  const completedAt = new Date().toISOString();
  const totalRecords = succeeded.reduce((total, item) => total + (item.count ?? 0), 0);
  const report: GestorVetDiscoveryReport = {
    status,
    completedAt,
    totalRecords,
    resources,
  };

  await db
    .from("integration_sync_runs")
    .update({
      status,
      cursor: { resources } as unknown as DbJson,
      records_read: totalRecords,
      records_failed: failed,
      error_summary: failed > 0 ? `${failed} recursos no pudieron leerse` : null,
      finished_at: completedAt,
    })
    .eq("id", run.id);

  const previousMetadata = objectValue(integration.metadata);
  const { error: metadataError } = await db
    .from("clinic_integrations")
    .update({
      metadata: {
        ...previousMetadata,
        discovery_status: status,
        discovery_completed_at: completedAt,
        discovery: report,
      } as unknown as DbJson,
    })
    .eq("id", integration.id);
  if (metadataError) throw new Error("El inventario terminó, pero no pudo guardarse");

  return report;
}
