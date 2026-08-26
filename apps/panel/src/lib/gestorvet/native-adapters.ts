import type { GestorVetRecord } from "./client";

function normalizedKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

export function gestorVetValue(record: GestorVetRecord, ...keys: string[]): string | null {
  const wanted = new Set(keys.map(normalizedKey));
  for (const [key, value] of Object.entries(record)) {
    if (!wanted.has(normalizedKey(key))) continue;
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      return text && text !== "0" ? text : null;
    }
  }
  return null;
}

export type GestorVetClientSummary = {
  externalId: string;
  name: string;
};

export function gestorVetClientSummary(record: GestorVetRecord): GestorVetClientSummary | null {
  const externalId = gestorVetValue(record, "ID");
  if (!externalId) return null;
  return {
    externalId,
    name: gestorVetValue(record, "NOMBRE") ?? "Sin nombre",
  };
}

export type GestorVetNativeAppointment = {
  externalId: string;
  startsAt: string;
  endsAt: string;
  clientName: string | null;
  petName: string | null;
  serviceName: string | null;
  durationMinutes: number;
  notes: string | null;
};

function wallClockPlusMinutes(value: string, minutes: number): string {
  const parsed = new Date(`${value}Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  parsed.setUTCMinutes(parsed.getUTCMinutes() + minutes);
  return parsed.toISOString().slice(0, 19);
}

function durationMinutes(value: string | null): number {
  if (!value) return 30;
  const parts = value.split(":").map(Number);
  if (parts.length < 2 || parts.some(Number.isNaN)) return 30;
  const minutes = (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  return minutes > 0 && minutes <= 8 * 60 ? minutes : 30;
}

export function gestorVetAppointment(record: GestorVetRecord): GestorVetNativeAppointment | null {
  const externalId = gestorVetValue(record, "ID");
  const date = gestorVetValue(record, "FECHA");
  if (!externalId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const rawTime = gestorVetValue(record, "HORA") ?? "00:00:00";
  const time = /^\d{2}:\d{2}(:\d{2})?$/.test(rawTime)
    ? rawTime.length === 5
      ? `${rawTime}:00`
      : rawTime
    : "00:00:00";
  const startsAt = `${date}T${time}`;
  const minutes = durationMinutes(gestorVetValue(record, "DURACION"));
  const clientId = gestorVetValue(record, "CLIENTE");
  const petId = gestorVetValue(record, "MASCOTA");
  const reasonId = gestorVetValue(record, "MOTIVOCONSULTA");

  return {
    externalId,
    startsAt,
    endsAt: wallClockPlusMinutes(startsAt, minutes),
    clientName: clientId ? `Cliente GestorVet #${clientId}` : null,
    petName: petId ? `Mascota #${petId}` : null,
    serviceName:
      gestorVetValue(record, "MOTIVO", "MOTIVOCONSULTA_NOMBRE") ??
      (reasonId ? `Motivo #${reasonId}` : null),
    durationMinutes: minutes,
    notes: gestorVetValue(record, "DESCRIPCION"),
  };
}
