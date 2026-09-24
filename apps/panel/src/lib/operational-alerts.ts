import type { OperationalLogRecord } from "./operational-logger";

export type OperationalAlertDefinition = {
  id: string;
  description: string;
  event: string;
  threshold: number;
  windowMs: number;
  groupBy: Array<keyof OperationalLogRecord>;
  matches?: (record: OperationalLogRecord) => boolean;
};

const GOOGLE_CALENDAR_ERROR_CODES = new Set([
  "GOOGLE_AUTH_REQUIRED",
  "GOOGLE_CALENDAR_UNAVAILABLE",
  "GOOGLE_NETWORK_ERROR",
  "GOOGLE_READ_FAILED",
  "GOOGLE_UPDATE_FAILED",
  "GOOGLE_DELETE_FAILED",
  "PROVIDER_FAILURE",
]);

const EXPECTED_APPOINTMENT_REJECTIONS = new Set([
  "CONFIRMATION_REQUIRED",
  "SLOT_NO_LONGER_AVAILABLE",
  "UNAVAILABLE",
]);

export const OPERATIONAL_ALERT_DEFINITIONS: OperationalAlertDefinition[] = [
  {
    id: "webhook_repeatedly_failed",
    description: "A provider webhook failed at least three times in five minutes.",
    event: "webhook.failed",
    threshold: 3,
    windowMs: 5 * 60_000,
    groupBy: ["clinic_id", "provider", "channel"],
  },
  {
    id: "google_calendar_unavailable",
    description: "Google Calendar failed twice in five minutes for the same clinic.",
    event: "tool.failed",
    threshold: 2,
    windowMs: 5 * 60_000,
    groupBy: ["clinic_id"],
    matches: (record) => GOOGLE_CALENDAR_ERROR_CODES.has(record.error_code ?? ""),
  },
  {
    id: "tool_failure_recurrent",
    description: "The same tool/error failed at least three times in ten minutes.",
    event: "tool.failed",
    threshold: 3,
    windowMs: 10 * 60_000,
    groupBy: ["clinic_id", "tool", "error_code"],
  },
  {
    id: "appointment_creation_failed",
    description: "A non-expected appointment creation failure occurred.",
    event: "tool.failed",
    threshold: 1,
    windowMs: 10 * 60_000,
    groupBy: ["clinic_id", "tool", "error_code"],
    matches: (record) =>
      record.tool === "create_appointment" &&
      !EXPECTED_APPOINTMENT_REJECTIONS.has(record.error_code ?? ""),
  },
  {
    id: "vapi_assistant_request_failed",
    description: "A Vapi assistant-request failed and may have blocked a call.",
    event: "vapi.assistant_request.failed",
    threshold: 1,
    windowMs: 5 * 60_000,
    groupBy: ["clinic_id", "provider"],
  },
  {
    id: "whatsapp_outbound_failed",
    description: "WhatsApp outbound delivery failed twice in five minutes.",
    event: "whatsapp.outbound.failed",
    threshold: 2,
    windowMs: 5 * 60_000,
    groupBy: ["clinic_id", "provider"],
  },
];

export type TriggeredOperationalAlert = {
  id: string;
  count: number;
  group: string;
  windowMs: number;
};

function groupKey(record: OperationalLogRecord, fields: Array<keyof OperationalLogRecord>): string {
  return fields.map((field) => `${String(field)}=${String(record[field] ?? "unknown")}`).join("|");
}

/** Pure evaluator used by tests and by a future log-drain/cron integration. */
export function evaluateOperationalAlerts(
  records: OperationalLogRecord[],
  now = new Date(),
): TriggeredOperationalAlert[] {
  const alerts: TriggeredOperationalAlert[] = [];

  for (const definition of OPERATIONAL_ALERT_DEFINITIONS) {
    const groups = new Map<string, number>();
    for (const record of records) {
      const ageMs = now.getTime() - new Date(record.timestamp).getTime();
      if (
        record.event !== definition.event ||
        ageMs < 0 ||
        ageMs > definition.windowMs ||
        (definition.matches && !definition.matches(record))
      ) {
        continue;
      }
      const group = groupKey(record, definition.groupBy);
      groups.set(group, (groups.get(group) ?? 0) + 1);
    }

    for (const [group, count] of groups) {
      if (count >= definition.threshold) {
        alerts.push({ id: definition.id, count, group, windowMs: definition.windowMs });
      }
    }
  }

  return alerts;
}
