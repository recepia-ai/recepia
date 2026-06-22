"use client";

import { AppointmentCard } from "./appointment-card";
import type { AppointmentWithDetails, BusinessHours } from "./types";
import {
  addDays,
  dayNameShort,
  isToday,
  appointmentsForDay,
  hoursForDay,
  generateSlots,
  timeToMinutes,
} from "./helpers";

type Props = {
  weekStart: Date;
  appointments: AppointmentWithDetails[];
  businessHours: BusinessHours | null;
};

const HOUR_HEIGHT = 48;
const MIN_CARD_HEIGHT = 22;

export function WeekView({ weekStart, appointments, businessHours }: Props) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Build the unified set of hourly slots across the week
  let globalSlots: { start: string; end: string }[] = [];
  if (businessHours) {
    const allSlots = days.flatMap((d) => {
      const dh = hoursForDay(businessHours, d);
      return dh.length > 0 ? generateSlots(dh, 60) : [];
    });
    // Deduplicate by time key
    const seen = new Set<string>();
    globalSlots = allSlots
      .filter((s) => {
        const key = `${s.start}-${s.end}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  }

  if (globalSlots.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-stone-500">
        Sin horarios definidos para esta semana.
      </div>
    );
  }

  const firstSlotMinutes = timeToMinutes(globalSlots[0]!.start);

  return (
    <div className="overflow-auto">
      <div className="flex min-w-[720px]">
        {/* Time gutter */}
        <div className="w-16 shrink-0">
          <div className="h-10" />
          {globalSlots.map((slot) => (
            <div
              key={slot.start}
              className="flex items-start justify-end pr-2"
              style={{ height: HOUR_HEIGHT }}
            >
              <span className="text-[10px] tabular-nums text-stone-400">
                {slot.start}
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day) => {
          const today = isToday(day);
          const dayHours = hoursForDay(businessHours, day);
          const open = dayHours.length > 0;
          const dayApps = appointmentsForDay(appointments, day);

          return (
            <div
              key={day.toDateString()}
              className={`flex-1 border-l border-stone-200 ${
                today ? "bg-emerald-50/50" : ""
              }`}
            >
              {/* Day header */}
              <div
                className={`flex h-10 items-center justify-center gap-1 border-b border-stone-200 ${
                  today ? "border-t-2 border-t-emerald-200" : ""
                }`}
              >
                <span className="text-xs font-medium text-stone-500">
                  {dayNameShort(day)}
                </span>
                <span
                  className={`flex size-5 items-center justify-center rounded-full text-xs font-semibold ${
                    today ? "bg-emerald-600 text-white" : "text-stone-700"
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>

              {/* Grid + appointment overlay container */}
              <div className="relative">
                {/* Background grid lines */}
                {globalSlots.map((slot) => (
                  <div
                    key={`${slot.start}-${slot.end}`}
                    className={`border-b border-stone-100 ${
                      !open ? "bg-stone-50" : ""
                    }`}
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}

                {/* Appointment overlays — positioned absolutely based on time */}
                {dayApps.map((appt) => {
                  const startDate = new Date(appt.starts_at);
                  const endDate = new Date(appt.ends_at);
                  const startMinutes =
                    startDate.getHours() * 60 + startDate.getMinutes();
                  const endMinutes =
                    endDate.getHours() * 60 + endDate.getMinutes();
                  const durationMinutes = Math.max(
                    1,
                    endMinutes - startMinutes,
                  );

                  const topPx =
                    ((startMinutes - firstSlotMinutes) / 60) * HOUR_HEIGHT;
                  const heightPx = Math.max(
                    MIN_CARD_HEIGHT,
                    (durationMinutes / 60) * HOUR_HEIGHT,
                  );

                  return (
                    <div
                      key={appt.id}
                      className="absolute left-0.5 right-0.5 z-10"
                      style={{
                        top: topPx,
                        height: heightPx,
                      }}
                    >
                      <AppointmentCard
                        appointment={appt}
                        variant="compact"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
