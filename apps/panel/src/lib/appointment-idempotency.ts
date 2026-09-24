import { createHash } from "node:crypto";

export type AppointmentEventIdentity = {
  client_id: string;
  pet_id: string;
  vet_user_id: string;
  service_id: string;
  starts_at: string;
};

export function googleAppointmentEventId(
  clinicId: string,
  input: AppointmentEventIdentity,
): string {
  const identity = [
    clinicId,
    input.client_id,
    input.pet_id,
    input.vet_user_id,
    input.service_id,
    new Date(input.starts_at).toISOString(),
  ].join(":");
  return `recepia${createHash("sha256").update(identity).digest("hex")}`;
}
