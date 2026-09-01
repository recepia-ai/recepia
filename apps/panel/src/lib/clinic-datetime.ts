import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

export const CLINIC_TIME_ZONE = "Europe/Madrid";

export function toClinicDate(value: string | Date): Date {
  return toZonedTime(value, CLINIC_TIME_ZONE);
}

export function formatClinicTime(value: string | Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: CLINIC_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatClinicDate(
  value: string | Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("es-ES", {
    ...options,
    timeZone: CLINIC_TIME_ZONE,
  }).format(new Date(value));
}

export function clinicDateKey(value: string | Date = new Date()): string {
  return formatInTimeZone(value, CLINIC_TIME_ZONE, "yyyy-MM-dd");
}

export function clinicDayBounds(value: string | Date = new Date()): {
  start: Date;
  end: Date;
} {
  const dateKey = clinicDateKey(value);
  const start = fromZonedTime(`${dateKey}T00:00:00`, CLINIC_TIME_ZONE);
  const nextDate = new Date(`${dateKey}T12:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const nextDateKey = nextDate.toISOString().slice(0, 10);
  const end = fromZonedTime(`${nextDateKey}T00:00:00`, CLINIC_TIME_ZONE);
  return { start, end };
}
