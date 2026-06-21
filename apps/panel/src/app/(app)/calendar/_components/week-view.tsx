"use client";

import { AppointmentCard } from "./appointment-card";
import type { AppointmentWithDetails, BusinessHours } from "./types";
import {
  mondayOf,
  addDays,
  dayNameShort,
  isToday,
  appointmentsForDay,
  hoursForDay,
  generateSlots,
  appointmentsForSlot,
  timeToMinutes,
} from "./helpers";

type Props = {
  weekStart: Date;
  appointments: AppointmentWithDetails[];
  businessHours: BusinessHours | null;
};

const HOUR_HEIGHT = 48;

export function WeekView({ weekStart, appointments, businessHours }: Props) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Find the overall time range across the week
  let globalSlots: { start: string; end: string }[] = [];
  if (businessHours) {
    const allSlots = days.flatMap((d) => {
      const dh = hoursForDay(businessHours, d);
      return dh.length > 0 ? generateSlots(dh, 60) : [];
    });
    // Deduplicate by time string
    const seen = new Set<string>();
    globalSlots = allSlots.filter((s) => {
      const key = `${s.start}-${s.end}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  }

  if (globalSlots.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-stone-500">
        Sin horarios definidos para esta semana.
      </div>
    );
  }

  const now = new Date();
  const renderedByDay = new Map<string, Set<string>>();
  days.forEach((d) => renderedByDay.set(d.toDateString(), new Set()));

  return (
    <div className="overflow-auto">
      <div className="flex min-w-[720px]">
        {/* Time gutter */}
        <div className="w-16 shrink-0">
          {/* Header spacer */}
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
          const dateKey = day.toDateString();
          const today = isToday(day);
          const dayHours = hoursForDay(businessHours, day);
          const open = dayHours.length > 0;

          return (
            <div
              key={dateKey}
              className={`flex-1 border-l border-stone-200 ${
                today ? "bg-emerald-50/30" : ""
              }`}
            >
              {/* Day header */}
              <div className="flex h-10 items-center justify-center gap-1 border-b border-stone-200">
                <span className="text-xs font-medium text-stone-500">
                  {dayNameShort(day)}
                </span>
                <span
                  className={`flex size-5 items-center justify-center rounded-full text-xs font-semibold ${
                    today
                      ? "bg-emerald-600 text-white"
                      : "text-stone-700"
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>

              {/* Time slots */}
              {globalSlots.map((slot) => {
                const slotApps = appointmentsForSlot(
                  appointments,
                  day,
                  slot.start,
                  slot.end,
                );
                const rendered = renderedByDay.get(dateKey)!;
                const newApps = slotApps.filter((a) => !rendered.has(a.id));

                // Mark as rendered
                newApps.forEach((a) => rendered.add(a.id));

                const slotDate = new Date(day);
                const [sh, sm] = slot.start.split(":").map(Number);
                slotDate.setHours(sh!, sm!, 0, 0);
                const isPast = slotDate < now && !isToday(day);

                return (
                  <div
                    key={slot.start}
                    className={`border-b border-stone-100 px-1 ${
                      isPast ? "opacity-40" : ""
                    } ${!open ? "bg-stone-50" : ""}`}
                    style={{ minHeight: HOUR_HEIGHT }}
                  >
                    {newApps.map((appt) => {
                      const startMin = new Date(appt.starts_at);
                      const endMin = new Date(appt.ends_at);
                      const durationHours =
                        (endMin.getTime() - startMin.getTime()) /
                        (60 * 60_000);
                      const heightPx = Math.max(
                        HOUR_HEIGHT,
                        Math.round(durationHours * HOUR_HEIGHT),
                      );

                      return (
                        <div key={appt.id} style={{ minHeight: heightPx }}>
                          <AppointmentCard
                            appointment={appt}
                            variant="compact"
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
