import { formatInTimeZone } from "date-fns-tz";

export const GOOGLE_CALENDAR_TIME_ZONE = "Europe/Madrid";

export function googleCalendarDateTime(instant: string): {
  dateTime: string;
  timeZone: string;
} {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Fecha inválida para Google Calendar: ${instant}`);
  }

  return {
    dateTime: formatInTimeZone(
      date,
      GOOGLE_CALENDAR_TIME_ZONE,
      "yyyy-MM-dd'T'HH:mm:ssXXX",
    ),
    timeZone: GOOGLE_CALENDAR_TIME_ZONE,
  };
}
