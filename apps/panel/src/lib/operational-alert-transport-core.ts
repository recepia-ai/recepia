import { createHash } from "node:crypto";

type AlertIdentity = {
  id: string;
  group: string;
  windowMs: number;
};

export type AlertSeverity = "warning" | "critical";

const CRITICAL_ALERTS = new Set(["appointment_creation_failed", "vapi_assistant_request_failed"]);

export function operationalAlertEventId(alert: AlertIdentity, now = new Date()): string {
  const groupHash = createHash("sha256").update(alert.group).digest("hex").slice(0, 16);
  const bucket = Math.floor(now.getTime() / alert.windowMs);
  return `alert:${alert.id}:${groupHash}:${bucket}`;
}

export function operationalAlertSeverity(id: string): AlertSeverity {
  return CRITICAL_ALERTS.has(id) ? "critical" : "warning";
}
