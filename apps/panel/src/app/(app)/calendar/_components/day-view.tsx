"use client";

import { AppointmentCard, formatTime } from "./appointment-card";
import { EmptySlot } from "./empty-slot";
import type { AppointmentWithDetails, BusinessHours } from "./types";
import {
  hoursForDay,
  isClinicOpen,
  generateSlots,
  appointmentsForSlot,
  sameDay,
  timeToMinutes,
} from "./helpers";
import { Coffee } from "lucide-react";

type Props = {
  date: Date;
  appointments: AppointmentWithDetails[];
  businessHours: BusinessHours | null;
};

export function DayView({ date, appointments, businessHours }: Props) {
  const dayHours = hoursForDay(businessHours, date);
  const open = isClinicOpen(businessHours, date);
  const slots = generateSlots(dayHours);
  const now = new Date();

  if (!open) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-stone-100">
          <Coffee className="size-6 text-stone-400" strokeWidth={1.75} />
        </div>
        <h3 className="mt-4 text-base font-semibold text-stone-900">
          Clínica cerrada
        </h3>
        <p className="mt-1 text-sm text-stone-500">
          No hay horario de apertura para este día.
        </p>
      </div>
    );
  }

  // Track which appointments we've rendered to avoid duplicates
  const rendered = new Set<string>();

  return (
    <div className="space-y-0">
      {slots.map((slot) => {
        const slotApps = appointmentsForSlot(
          appointments,
          date,
          slot.start,
          slot.end,
        );

        // Build slot datetime to compare with now
        const slotDate = new Date(date);
        const [sh, sm] = slot.start.split(":").map(Number);
        slotDate.setHours(sh!, sm!, 0, 0);
        const isPast = slotDate < now && !sameDay(slotDate, now);

        return (
          <div
            key={`${slot.start}-${slot.end}`}
            className={`flex min-h-[48px] border-b border-stone-100 ${isPast ? "opacity-40" : ""}`}
          >
            {/* Time label */}
            <div className="flex w-16 shrink-0 items-start pt-2">
              <span className="text-xs tabular-nums text-stone-400">
                {slot.start}
              </span>
            </div>

            {/* Content area */}
            <div className="min-w-0 flex-1 py-0.5 pr-3">
              {slotApps.length === 0 ? (
                <EmptySlot height={48} />
              ) : (
                slotApps.map((appt) => {
                  if (rendered.has(appt.id)) return null;
                  rendered.add(appt.id);

                  // Calculate how many 30-min slots this appointment spans
                  const startMin = new Date(appt.starts_at);
                  const endMin = new Date(appt.ends_at);
                  const durationSlots = Math.max(
                    1,
                    Math.ceil(
                      (endMin.getTime() - startMin.getTime()) / (30 * 60_000),
                    ),
                  );

                  return (
                    <div
                      key={appt.id}
                      style={{ minHeight: durationSlots * 48 }}
                    >
                      <AppointmentCard appointment={appt} variant="default" />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
