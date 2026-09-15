export type AppointmentResolution = "none" | "unique" | "ambiguous";

type AvailableSlot = {
  vet_user_id: string;
  starts_at: string;
};

function sameInstant(left: string, right: string): boolean {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

export function classifyAppointmentResolution(matches: unknown[]): AppointmentResolution {
  if (matches.length === 0) return "none";
  return matches.length === 1 ? "unique" : "ambiguous";
}

export function hasRequiredAppointmentMutationConfirmation(
  confirmedAction: "modify" | "cancel" | null,
  requestedAction: "modify" | "cancel",
): boolean {
  return confirmedAction === requestedAction;
}

export function isRequestedRescheduleAvailable(
  slots: AvailableSlot[],
  startsAt: string,
  vetUserId: string,
): boolean {
  return slots.some(
    (slot) => slot.vet_user_id === vetUserId && sameInstant(slot.starts_at, startsAt),
  );
}

export function mergeAppointmentNotes(
  existingNotes: string | null,
  requestedNotes: string,
  mode: "append" | "replace",
): string {
  const existing = existingNotes?.trim() ?? "";
  const requested = requestedNotes.trim();

  if (mode === "replace" || !existing) return requested;
  if (existing.toLocaleLowerCase("es").includes(requested.toLocaleLowerCase("es"))) return existing;
  if (requested.toLocaleLowerCase("es").includes(existing.toLocaleLowerCase("es"))) {
    return requested;
  }
  return `${existing}\n${requested}`;
}

export function updateGoogleCalendarNotes(
  existingDescription: string | null | undefined,
  notes: string,
): string {
  const withoutNotes = (existingDescription ?? "").replace(/\n?Notas:[\s\S]*$/i, "").trimEnd();
  return [withoutNotes, `Notas: ${notes}`].filter(Boolean).join("\n");
}
