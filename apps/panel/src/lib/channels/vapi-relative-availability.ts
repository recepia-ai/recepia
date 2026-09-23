import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

type AvailabilityInput = Record<string, unknown>;

export type RelativeAvailabilityResolution = {
  input: AvailabilityInput;
  relativeExpression: string | null;
};

function normalizedText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es");
}

function addCalendarDays(localDate: string, days: number): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days));
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function zonedIso(localDate: string, localTime: string, timezone: string): string {
  return formatInTimeZone(
    fromZonedTime(`${localDate}T${localTime}`, timezone),
    timezone,
    "yyyy-MM-dd'T'HH:mm:ssXXX",
  );
}

export function hasRelativeAvailabilityIntent(message: string): boolean {
  const text = normalizedText(message);
  const withoutMorningDayPart = text.replace(/\b(?:por la|de la)\s+manana\b/g, "");
  return (
    /\bhoy\b/.test(text) ||
    /\bmanana\b/.test(withoutMorningDayPart) ||
    /\besta\s+(manana|tarde|noche)\b/.test(text) ||
    /\bpasado\s+manana\b/.test(text)
  );
}

/**
 * Makes relative voice requests deterministic before check_availability runs.
 * Vapi/LLM date arithmetic is never trusted when the user's words already
 * identify an unambiguous local day or day-part.
 */
export function resolveRelativeAvailabilityInput(
  input: AvailabilityInput,
  userMessage: string | null,
  timezone: string,
  now = new Date(),
): RelativeAvailabilityResolution {
  if (!userMessage || !hasRelativeAvailabilityIntent(userMessage)) {
    return { input, relativeExpression: null };
  }

  const text = normalizedText(userMessage);
  const withoutMorningDayPart = text.replace(/\b(?:por la|de la|esta)\s+manana\b/g, "");
  const dayOffset = /\bpasado\s+manana\b/.test(text)
    ? 2
    : /\bmanana\b/.test(withoutMorningDayPart)
      ? 1
      : 0;
  const today = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  const targetDate = addCalendarDays(today, dayOffset);

  let startTime = "00:00:00";
  let endTime = "23:59:59";
  if (/\b(por la manana|esta manana|de la manana)\b/.test(text)) {
    endTime = "13:59:59";
  } else if (/\b(por la tarde|esta tarde|de la tarde)\b/.test(text)) {
    startTime = "14:00:00";
  } else if (/\b(por la noche|esta noche|de la noche)\b/.test(text)) {
    startTime = "20:00:00";
  }

  return {
    input: {
      ...input,
      date_from: zonedIso(targetDate, startTime, timezone),
      date_to: zonedIso(targetDate, endTime, timezone),
    },
    relativeExpression: userMessage,
  };
}
