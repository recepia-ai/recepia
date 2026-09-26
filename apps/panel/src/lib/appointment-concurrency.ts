type DatabaseErrorLike = {
  code?: string | null;
};

export function isAppointmentIdentityConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as DatabaseErrorLike).code === "23505"
  );
}

export function shouldDeleteGoogleEventAfterInsertFailure(input: {
  insertError: unknown;
  eventCreatedByThisAttempt: boolean;
}): boolean {
  return input.eventCreatedByThisAttempt && !isAppointmentIdentityConflict(input.insertError);
}

export function isActiveAppointmentStatus(status: string): boolean {
  return status !== "cancelled";
}
