export type AppointmentIntent = {
  conversation_id: string;
  client_id: string;
  pet_id: string;
  vet_user_id: string;
  service_id: string;
  starts_at: string;
};

export type ExistingAppointment = AppointmentIntent & {
  id: string;
  status: string;
  google_event_id: string | null;
};

type ToolAttempt = {
  name: string;
  output: { success: boolean };
};

const APPOINTMENT_IDENTITY_FIELDS = [
  "client_id",
  "pet_id",
  "vet_user_id",
  "service_id",
  "starts_at",
] as const;

function sameInstant(left: string, right: string): boolean {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

export function findMatchingConfirmedAppointment(
  appointments: ExistingAppointment[],
  intent: AppointmentIntent,
): ExistingAppointment | null {
  return (
    appointments.find(
      (appointment) =>
        appointment.status === "confirmed" &&
        appointment.conversation_id === intent.conversation_id &&
        appointment.client_id === intent.client_id &&
        appointment.pet_id === intent.pet_id &&
        appointment.vet_user_id === intent.vet_user_id &&
        appointment.service_id === intent.service_id &&
        sameInstant(appointment.starts_at, intent.starts_at),
    ) ?? null
  );
}

export function isSameAppointmentToolInput(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  return APPOINTMENT_IDENTITY_FIELDS.every((field) => {
    if (
      field === "starts_at" &&
      typeof left[field] === "string" &&
      typeof right[field] === "string"
    ) {
      return sameInstant(left[field], right[field]);
    }
    return left[field] === right[field];
  });
}

export function markAppointmentResultReused<T extends { success: boolean }>(result: T): T {
  if (!result.success || !("data" in result) || !result.data || typeof result.data !== "object") {
    return result;
  }

  return {
    ...result,
    data: { ...result.data, already_created: true },
  };
}

export function shouldBlockBookingErrorEscalation(
  reason: unknown,
  currentUserMessage: string,
  attempts: ToolAttempt[],
): boolean {
  const userRequestsHuman =
    /\b(?:hablar|contactar|pásame|pasame|transferirme|transfiéreme)\b[^.?!]{0,60}\b(?:persona|humano|humana|veterinari[oa]|recepcionista|equipo|samuel)\b/i.test(
      currentUserMessage,
    ) ||
    /\b(?:quiero|prefiero|necesito)\b[^.?!]{0,30}\b(?:persona|humano|humana|veterinari[oa]|recepcionista)\b/i.test(
      currentUserMessage,
    );

  if (reason === "client_request" && !userRequestsHuman) {
    return true;
  }

  const hasBookingFailure = attempts.some(
    (attempt) =>
      (attempt.name === "create_appointment" || attempt.name === "cancel_appointment") &&
      !attempt.output.success,
  );

  return hasBookingFailure && (reason === "other" || reason === "ambiguity_unresolved");
}
