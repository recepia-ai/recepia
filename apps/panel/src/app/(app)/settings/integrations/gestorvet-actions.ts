"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { GestorVetClient } from "@/lib/gestorvet/client";
import {
  discoverGestorVet,
  type GestorVetDiscoveryReport,
  type GestorVetDiscoveryResource,
} from "@/lib/gestorvet/discovery";
import { dryRunGestorVet, type GestorVetDryRunReport } from "@/lib/gestorvet/dry-run";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const settingsSchema = z.object({
  noc: z.string().trim().min(1, "El NOC es obligatorio").max(100),
  api_key: z.string().trim().min(8, "La API key no parece válida").max(500),
});

const fieldMapSchema = z.record(z.string(), z.string().nullable());
const dryRunReportSchema = z.object({
  status: z.literal("succeeded"),
  completedAt: z.string(),
  totalRecords: z.number(),
  clients: z.object({
    total: z.number(),
    requiresDetailedRead: z.boolean(),
    detailFields: z.array(z.string()),
    eligibleAfterReview: z.number(),
    existingPhoneMatches: z.number(),
    missingPhone: z.number(),
    invalidPhone: z.number(),
    missingName: z.number(),
    duplicatePhoneGroups: z.number(),
    duplicatePhoneRecords: z.number(),
    fields: fieldMapSchema,
  }),
  pets: z.object({
    total: z.number(),
    requiresDetailedRead: z.boolean(),
    detailFields: z.array(z.string()),
    eligibleAfterReview: z.number(),
    existingMicrochipMatches: z.number(),
    orphanOwner: z.number(),
    missingName: z.number(),
    missingSpecies: z.number(),
    duplicateMicrochipGroups: z.number(),
    fields: fieldMapSchema,
  }),
  appointments: z.object({
    total: z.number(),
    requiresDetailedRead: z.boolean(),
    eligibleAfterMapping: z.number(),
    orphanClient: z.number(),
    orphanPet: z.number(),
    unknownUser: z.number(),
    unknownReason: z.number(),
    missingDate: z.number(),
    fields: fieldMapSchema,
  }),
  mappingsPending: z.object({
    species: z.number(),
    users: z.number(),
    consultationReasons: z.number(),
  }),
});

export type GestorVetSettings = {
  connected: boolean;
  noc?: string;
  syncEnabled: boolean;
  connectedAt?: string;
  discovery?: GestorVetDiscoveryReport;
  dryRun?: GestorVetDryRunReport;
};

function discoveryResource(value: unknown): GestorVetDiscoveryResource | null {
  const record = objectValue(value);
  if (
    typeof record.resource !== "string" ||
    (record.status !== "succeeded" && record.status !== "failed")
  ) {
    return null;
  }
  return {
    resource: record.resource,
    count: typeof record.count === "number" ? record.count : null,
    fields: Array.isArray(record.fields)
      ? record.fields.filter((field): field is string => typeof field === "string")
      : [],
    status: record.status,
  };
}

function discoveryReport(value: unknown): GestorVetDiscoveryReport | undefined {
  const record = objectValue(value);
  if (
    (record.status !== "succeeded" && record.status !== "partial" && record.status !== "failed") ||
    typeof record.completedAt !== "string" ||
    typeof record.totalRecords !== "number" ||
    !Array.isArray(record.resources)
  ) {
    return undefined;
  }
  return {
    status: record.status,
    completedAt: record.completedAt,
    totalRecords: record.totalRecords,
    resources: record.resources
      .map(discoveryResource)
      .filter((resource): resource is GestorVetDiscoveryResource => resource !== null),
  };
}

function dryRunReport(value: unknown): GestorVetDryRunReport | undefined {
  const parsed = dryRunReportSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function adminClinic() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "No autenticado" as const };
  const { data } = await supabase
    .from("clinic_users")
    .select("clinic_id, role")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (data?.role !== "admin") {
    return { error: "Solo el administrador puede configurar GestorVet" as const };
  }
  return { clinicId: data.clinic_id };
}

export async function getGestorVetSettings(): Promise<GestorVetSettings> {
  const access = await adminClinic();
  if ("error" in access) return { connected: false, syncEnabled: false };

  const db = createAdminClient();
  const { data } = await db
    .from("clinic_integrations")
    .select("vault_secret_id, metadata, created_at")
    .eq("clinic_id", access.clinicId)
    .eq("provider", "gestorvet")
    .maybeSingle();
  if (!data) return { connected: false, syncEnabled: false };

  const metadata = objectValue(data.metadata);
  return {
    connected: Boolean(data.vault_secret_id),
    noc: typeof metadata.noc === "string" ? metadata.noc : undefined,
    syncEnabled: metadata.sync_enabled === true,
    connectedAt:
      typeof metadata.connected_at === "string" ? metadata.connected_at : data.created_at,
    discovery: discoveryReport(metadata.discovery),
    dryRun: dryRunReport(metadata.dry_run),
  };
}

export async function runGestorVetDiscovery() {
  const access = await adminClinic();
  if ("error" in access) return { error: access.error };

  try {
    const report = await discoverGestorVet(createAdminClient(), access.clinicId);
    revalidatePath("/settings/integrations");
    return { success: true, report };
  } catch {
    return { error: "No se pudo completar el inventario de GestorVet" };
  }
}

export async function runGestorVetDryRun() {
  const access = await adminClinic();
  if ("error" in access) return { error: access.error };

  try {
    const report = await dryRunGestorVet(createAdminClient(), access.clinicId);
    revalidatePath("/settings/integrations");
    return { success: true, report };
  } catch {
    return { error: "No se pudo completar el análisis previo de GestorVet" };
  }
}

export async function saveGestorVetIntegration(formData: FormData) {
  const access = await adminClinic();
  if ("error" in access) return { error: access.error };

  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  // Read-only connectivity check before persisting the credential.
  try {
    const client = new GestorVetClient({
      apiKey: parsed.data.api_key,
      noc: parsed.data.noc,
    });
    await client.getClinicData();
  } catch {
    return {
      error: "GestorVet rechazó la conexión. Comprueba el NOC y la API key.",
    };
  }

  const db = createAdminClient();
  const { data: current, error: currentError } = await db
    .from("clinic_integrations")
    .select("id, vault_secret_id, metadata")
    .eq("clinic_id", access.clinicId)
    .eq("provider", "gestorvet")
    .maybeSingle();
  if (currentError) return { error: "No se pudo leer la integración actual" };

  const secret = JSON.stringify({
    apiKey: parsed.data.api_key,
    noc: parsed.data.noc,
  });
  const secretName = `gestorvet_clinic_${access.clinicId}`;
  const secretDescription = `GestorVet credentials — clinic ${access.clinicId}`;

  try {
    let vaultSecretId = current?.vault_secret_id as string | undefined;
    if (vaultSecretId) {
      const { error } = await db.rpc("vault_update_secret", {
        p_id: vaultSecretId,
        p_secret: secret,
        p_name: secretName,
        p_description: secretDescription,
      });
      if (error) throw error;
    } else {
      const { data, error } = await db.rpc("vault_create_secret", {
        p_secret: secret,
        p_name: secretName,
        p_description: secretDescription,
      });
      if (error || !data) throw error ?? new Error("Vault did not return an ID");
      vaultSecretId = data as string;
    }

    const previousMetadata = objectValue(current?.metadata);
    const metadata = {
      ...previousMetadata,
      mode: "coexistence",
      noc: parsed.data.noc,
      sync_enabled: false,
      discovery_status: "pending",
      connected_at:
        typeof previousMetadata.connected_at === "string"
          ? previousMetadata.connected_at
          : new Date().toISOString(),
    };
    const values = {
      clinic_id: access.clinicId,
      provider: "gestorvet",
      vault_secret_id: vaultSecretId,
      token_expires_at: null,
      scope: "read_write",
      external_account_email: null,
      metadata,
    };

    const { error } = current?.id
      ? await db.from("clinic_integrations").update(values).eq("id", current.id)
      : await db.from("clinic_integrations").insert(values);
    if (error) throw error;

    revalidatePath("/settings/integrations");
    return { success: true };
  } catch {
    return { error: "No se pudo guardar la conexión de GestorVet de forma segura" };
  }
}
