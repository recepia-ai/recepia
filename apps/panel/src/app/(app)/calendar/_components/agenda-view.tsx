"use client";

import { AppointmentCard } from "./appointment-card";
import { formatDate } from "./appointment-card";
import type { AppointmentWithDetails } from "./types";
import { sameDay } from "./helpers";

type Props = {
  appointments: AppointmentWithDetails[];
};

export function AgendaView({ appointments }: Props) {
  // Group by day
  const groups = new Map<string, AppointmentWithDetails[]>();
  const days: string[] = [];

  for (const appt of appointments) {
    const d = new Date(appt.starts_at);
    const key = d.toDateString();
    if (!groups.has(key)) {
      groups.set(key, []);
      days.push(key);
    }
    groups.get(key)!.push(appt);
  }

  if (days.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-stone-500">No hay citas programadas</p>
        <p className="mt-1 text-xs text-stone-400">
          Las próximas citas aparecerán aquí
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {days.map((day, di) => {
        const dayApps = groups.get(day)!;
        return (
          <div key={day}>
            {/* Day header */}
            <div className="mb-3 flex items-center gap-3">
              <h3 className="text-sm font-semibold text-stone-900">
                {formatDate(dayApps[0]!.starts_at)}
              </h3>
              <div className="h-px flex-1 bg-stone-100" />
              <span className="text-xs text-stone-400">
                {dayApps.length} {dayApps.length === 1 ? "cita" : "citas"}
              </span>
            </div>

            {/* Appointments */}
            <div className="space-y-3">
              {dayApps.map((appt) => (
                <AppointmentCard
                  key={appt.id}
                  appointment={appt}
                  variant="expanded"
                />
              ))}
            </div>

            {/* Divider between days */}
            {di < days.length - 1 && <div className="mt-8" />}
          </div>
        );
      })}
    </div>
  );
}
