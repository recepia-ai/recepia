import { randomUUID } from "node:crypto";
import type { Database } from "@recepia/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  operationalAlertEventId,
  operationalAlertSeverity,
} from "./operational-alert-transport-core";
import { evaluateOperationalAlerts, OPERATIONAL_ALERT_DEFINITIONS } from "./operational-alerts";
import type { OperationalLogRecord } from "./operational-logger";

export {
  operationalAlertEventId,
  operationalAlertSeverity,
} from "./operational-alert-transport-core";

type AdminClient = SupabaseClient<Database>;

function channel(value: string | undefined): "web" | "whatsapp" | "phone" {
  return value === "whatsapp" || value === "phone" ? value : "web";
}

/**
 * Durable, lightweight alert transport. Signals and deduplicated alerts use the
 * existing channel_events table; the destination is Settings → Operations.
 * Transport failures are deliberately non-fatal to the customer interaction.
 */
export async function recordOperationalSignal(
  supabaseAdmin: AdminClient,
  record: OperationalLogRecord,
): Promise<void> {
  if (!record.clinic_id) return;

  try {
    const payload = JSON.parse(JSON.stringify(record));
    const { error: signalError } = await supabaseAdmin.from("channel_events").insert({
      clinic_id: record.clinic_id,
      conversation_id: record.conversation_id ?? null,
      channel: channel(record.channel),
      provider: "recepia-operations",
      event_id: `signal:${record.event}:${randomUUID()}`,
      event_type: "operational.signal",
      status: "completed",
      payload,
      occurred_at: record.timestamp,
      processed_at: record.timestamp,
    });
    if (signalError) throw signalError;

    const maxWindowMs = Math.max(
      ...OPERATIONAL_ALERT_DEFINITIONS.map((definition) => definition.windowMs),
    );
    const { data, error } = await supabaseAdmin
      .from("channel_events")
      .select("payload")
      .eq("clinic_id", record.clinic_id)
      .eq("provider", "recepia-operations")
      .eq("event_type", "operational.signal")
      .gte("occurred_at", new Date(Date.now() - maxWindowMs).toISOString())
      .order("occurred_at", { ascending: false })
      .limit(500);
    if (error) throw error;

    const records = (data ?? [])
      .map((row) => row.payload)
      .filter((value): value is OperationalLogRecord =>
        Boolean(value && typeof value === "object" && !Array.isArray(value)),
      );
    const now = new Date();
    const alerts = evaluateOperationalAlerts(records, now);

    for (const alert of alerts) {
      const definition = OPERATIONAL_ALERT_DEFINITIONS.find((item) => item.id === alert.id);
      const alertPayload = {
        alert_id: alert.id,
        severity: operationalAlertSeverity(alert.id),
        count: alert.count,
        group: alert.group,
        description: definition?.description ?? alert.id,
        destination: "settings_operations",
      };
      const { error: alertError } = await supabaseAdmin.from("channel_events").insert({
        clinic_id: record.clinic_id,
        conversation_id: record.conversation_id ?? null,
        channel: channel(record.channel),
        provider: "recepia-operations",
        event_id: operationalAlertEventId(alert, now),
        event_type: "operational.alert",
        status: "completed",
        payload: alertPayload,
        occurred_at: now.toISOString(),
        processed_at: now.toISOString(),
      });
      if (alertError && alertError.code !== "23505") throw alertError;
    }
  } catch (error) {
    console.error(
      "[operational-alert-transport] failed",
      error instanceof Error ? error.message : error,
    );
  }
}
