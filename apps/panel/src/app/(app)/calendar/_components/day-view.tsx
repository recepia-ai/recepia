"use client";

import { AppointmentCard } from "./appointment-card";
import { EmptySlot } from "./empty-slot";
import type { AppointmentWithDetails, BusinessHours } from "./types";
import {
  hoursForDay,
  isClinicOpen,
  generateSlots,
  appointmentsForSlot,
  sameDay,
  timeToMinutes,
  appointmentsForDay,
} from "./helpers";
import { Coffee } from "lucide-react";

type Props = {
  date: Date;
  appointments: AppointmentWithDetails[];
  businessHours: BusinessHours | null;
};

const SLOT_HEIGHT = 48; // 30-min slot in pixels
const MIN_CARD_HEIGHT = 20;

export function DayView({ date, appointments, businessHours }: Props) {
  const dayHours = hoursForDay(businessHours, date);
  const open = isClinicOpen(businessHours, date);
  const slots = generateSlots(dayHours);
  const dayApps = appointmentsForDay(appointments, date);
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

  if (slots.length === 0) return null;

  // Prevent rendering the same multi-slot appointment in every slot it covers
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
        const slotStartMin = timeToMinutes(slot.start);

        const slotDate = new Date(date);
        const [sh, sm] = slot.start.split(":").map(Number);
        slotDate.setHours(sh!, sm!, 0, 0);
        const isPast = slotDate < now && !sameDay(slotDate, now);

        return (
          <div
            key={`${slot.start}-${slot.end}`}
            className={`flex min-h-[48px] border-b border-stone-100 ${
              isPast ? "opacity-40" : ""
            }`}
          >
            {/* Time label */}
            <div className="flex w-16 shrink-0 items-start pt-2">
              <span className="text-xs tabular-nums text-stone-400">
                {slot.start}
              </span>
            </div>

            {/* Content area */}
            <div className="min-w-0 flex-1 relative py-0.5 pr-3">
              {/* Background empty indicator when no appointment starts in this slot */}
              {slotApps.filter((a) => !rendered.has(a.id)).length === 0 && (
                <EmptySlot height={SLOT_HEIGHT} />
              )}

              {slotApps.map((appt) => {
                if (rendered.has(appt.id)) return null;
                rendered.add(appt.id);

                const startDate = new Date(appt.starts_at);
                const endDate = new Date(appt.ends_at);
                const startMin =
                  startDate.getHours() * 60 + startDate.getMinutes();
                const endMin =
                  endDate.getHours() * 60 + endDate.getMinutes();
                const durationMin = Math.max(1, endMin - startMin);

                const topPx =
                  ((startMin - slotStartMin) / 30) * SLOT_HEIGHT;
                const heightPx = Math.max(
                  MIN_CARD_HEIGHT,
                  (durationMin / 30) * SLOT_HEIGHT,
                );

                return (
                  <div
                    key={appt.id}
                    className="absolute left-0 right-0 z-10"
                    style={{ top: topPx, height: heightPx }}
                  >
                    <AppointmentCard appointment={appt} variant="default" />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
