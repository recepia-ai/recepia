import { formatInTimeZone } from "date-fns-tz";

export const DEFAULT_CLINIC_TIMEZONE = "Europe/Madrid";

export function resolveAvailabilityWindow(
  dateFrom: string,
  dateTo: string,
  now = new Date(),
  timezone = DEFAULT_CLINIC_TIMEZONE,
): { earliest: Date; error?: string } {
  const requestedFrom = new Date(dateFrom);
  const requestedTo = new Date(dateTo);

  if (requestedTo <= now) {
    return {
      earliest: now,
      error: `El rango solicitado ya ha pasado. Ahora es ${formatInTimeZone(now, timezone, "yyyy-MM-dd HH:mm:ss XXX")} (${timezone}). Solicita un rango futuro.`,
    };
  }

  return { earliest: requestedFrom > now ? requestedFrom : now };
}
