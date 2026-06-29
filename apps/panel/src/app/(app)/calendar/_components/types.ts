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
};

/** Business hours for a single day: array of open intervals. */
export type DayHours = { start: string; end: string }[];

/** Raw business hours map from clinic_config. */
export type BusinessHours = Record<string, DayHours>;

export type ViewMode = "day" | "week" | "month" | "agenda";
