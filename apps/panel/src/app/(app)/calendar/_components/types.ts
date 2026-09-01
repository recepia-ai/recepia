/** A single appointment with joined client, pet, and service data. */
export type AppointmentWithDetails = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  client_name: string | null;
  client_phone: string | null;
  pet_name: string | null;
  pet_species: string | null;
  service_name: string | null;
  service_duration_minutes: number | null;
  vet_user_id: string | null;
  vet_name: string | null;
  source: "recepia" | "gestorvet";
  external_id: string | null;
};

/** Business hours for a single day: array of open intervals. */
export type DayHours = { start: string; end: string }[];

/** Raw business hours map from clinic_config. */
export type BusinessHours = Record<string, DayHours>;

export type ViewMode = "day" | "week" | "month" | "agenda";

export type CalendarVet = { id: string; name: string };
export type CalendarClientOption = { id: string; name: string; phone: string };
export type CalendarPetOption = { id: string; client_id: string; name: string };
export type CalendarServiceOption = { id: string; name: string; duration_minutes: number };
