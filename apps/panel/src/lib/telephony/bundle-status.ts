/**
 * Sincroniza el estado del Regulatory Bundle desde Twilio a telephony_numbers.
 *
 * Cierra el hueco entre "enviar bundle" (fase 2) y "comprar" (fase 3): la compra
 * se gatea con bundle_status='twilio_approved', y este comando trae ese estado de
 * Twilio en lugar de tener que actualizarlo a mano.
 *
 * Escribe con service_role (createAdminClient). Idempotente: solo actualiza si cambia.
 */
import type { Database } from "@recepia/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { twilioNumbers } from "./twilio-client";

type BundleStatus = Database["public"]["Enums"]["regulatory_bundle_status"];
type TelephonyUpdate = Database["public"]["Tables"]["telephony_numbers"]["Update"];

// Twilio usa guiones; nuestro enum usa guiones bajos.
const TWILIO_STATUS_MAP: Record<string, BundleStatus> = {
  draft: "draft",
  "pending-review": "pending_review",
  "in-review": "in_review",
  "twilio-approved": "twilio_approved",
  "twilio-rejected": "twilio_rejected",
  "provisionally-approved": "provisionally_approved",
};

export type BundleSyncOutcome = {
  numberId: string;
  phoneNumber: string;
  bundleSid: string;
  previous: BundleStatus;
  current: BundleStatus;
  changed: boolean;
  error?: string;
};

export type BundleSyncResult =
  | { success: true; synced: BundleSyncOutcome[] }
  | { success: false; error: string };

type TwilioBundle = {
  sid: string;
  status: string;
  valid_until?: string | null;
  failure_reason?: string | null;
};

export async function syncBundleStatus(
  opts: { clinicId?: string } = {},
): Promise<BundleSyncResult> {
  const admin = createAdminClient();

  let query = admin
    .from("telephony_numbers")
    .select("id, clinic_id, phone_number, twilio_bundle_sid, bundle_status, bundle_approved_at")
    .not("twilio_bundle_sid", "is", null);
  if (opts.clinicId) query = query.eq("clinic_id", opts.clinicId);

  const { data: rows, error } = await query;
  if (error) return { success: false, error: `Leer telephony_numbers: ${error.message}` };
  if (!rows || rows.length === 0) return { success: true, synced: [] };

  const synced: BundleSyncOutcome[] = [];

  for (const row of rows) {
    const bundleSid = row.twilio_bundle_sid;
    if (!bundleSid) continue;
    const previous = row.bundle_status as BundleStatus;

    const res = await twilioNumbers<TwilioBundle>(
      "GET",
      `/RegulatoryCompliance/Bundles/${bundleSid}`,
    );
    if (!res.ok) {
      synced.push({
        numberId: row.id,
        phoneNumber: row.phone_number,
        bundleSid,
        previous,
        current: previous,
        changed: false,
        error: res.error,
      });
      continue; // resiliente: un fallo por fila no aborta el resto (multi-tenant)
    }

    const validUntil = res.data.valid_until ?? null;
    let mapped = TWILIO_STATUS_MAP[res.data.status];
    if (!mapped) {
      synced.push({
        numberId: row.id,
        phoneNumber: row.phone_number,
        bundleSid,
        previous,
        current: previous,
        changed: false,
        error: `Estado Twilio desconocido: ${res.data.status}`,
      });
      continue;
    }
    // Aprobado pero ya caducado → expired.
    if (mapped === "twilio_approved" && validUntil && new Date(validUntil).getTime() < Date.now()) {
      mapped = "expired";
    }

    const changed = mapped !== previous;
    if (changed) {
      const update: TelephonyUpdate = {
        bundle_status: mapped,
        bundle_expires_at: validUntil,
      };
      if (mapped === "twilio_approved" && !row.bundle_approved_at) {
        update.bundle_approved_at = new Date().toISOString();
      }
      if (mapped === "twilio_rejected") {
        update.rejection_reason = res.data.failure_reason ?? "Rechazado por Twilio";
      }
      const up = await admin.from("telephony_numbers").update(update).eq("id", row.id);
      if (up.error) {
        synced.push({
          numberId: row.id,
          phoneNumber: row.phone_number,
          bundleSid,
          previous,
          current: previous,
          changed: false,
          error: `Actualizar fila: ${up.error.message}`,
        });
        continue;
      }
    }

    synced.push({
      numberId: row.id,
      phoneNumber: row.phone_number,
      bundleSid,
      previous,
      current: mapped,
      changed,
    });
  }

  return { success: true, synced };
}
