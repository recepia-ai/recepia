export type OperationalLogLevel = "info" | "warn" | "error";

export type OperationalLogContext = {
  clinic_id?: string;
  conversation_id?: string;
  call_session_id?: string;
  channel?: string;
  provider?: string;
  event_id?: string;
  tool?: string;
  appointment_id?: string;
  error_code?: string;
  duration_ms?: number;
  status?: string;
  duplicate?: boolean;
};

export type OperationalLogRecord = OperationalLogContext & {
  timestamp: string;
  service: "recepia-panel";
  level: OperationalLogLevel;
  event: string;
};

/**
 * Operational logs deliberately contain identifiers and outcome metadata only.
 * Message bodies, phone numbers, tool inputs and provider payloads must not be
 * added here because application logs are not a clinical-data store.
 */
export function createOperationalLogRecord(
  level: OperationalLogLevel,
  event: string,
  context: OperationalLogContext = {},
  now = new Date(),
): OperationalLogRecord {
  return {
    timestamp: now.toISOString(),
    service: "recepia-panel",
    level,
    event,
    ...Object.fromEntries(Object.entries(context).filter(([, value]) => value !== undefined)),
  };
}

export function operationalErrorCode(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.trim()) return code;
  }
  return fallback;
}

export function operationalLog(
  level: OperationalLogLevel,
  event: string,
  context: OperationalLogContext = {},
): void {
  const serialized = JSON.stringify(createOperationalLogRecord(level, event, context));
  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else {
    console.info(serialized);
  }
}
