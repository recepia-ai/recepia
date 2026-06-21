"use client";

import type { AppointmentWithDetails, BusinessHours } from "./types";
import {
  monthGrid,
  dayNameShort,
  isToday,
  isSameMonth,
  appointmentsForDay,
} from "./helpers";
import type { ViewMode } from "./types";

type Props = {
  date: Date;
  appointments: AppointmentWithDetails[];
  onDayClick: (date: Date) => void;
};

export function MonthView({ date, appointments, onDayClick }: Props) {
  const weeks = monthGrid(date);
  const MAX_VISIBLE = 3;

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((name) => (
          <div
            key={name}
            className="py-2 text-center text-xs font-medium uppercase tracking-wider text-stone-500"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-stone-100 last:border-b-0">
          {week.map((day) => {
            const today = isToday(day);
            const inMonth = isSameMonth(day, date);
            const dayApps = appointmentsForDay(appointments, day);
            const overflow = dayApps.length - MAX_VISIBLE;

            return (
              <button
                key={day.toDateString()}
                onClick={() => onDayClick(day)}
                className={`flex min-h-[100px] flex-col border-r border-stone-100 p-1.5 text-left transition-colors last:border-r-0 hover:bg-stone-50 ${
                  !inMonth ? "opacity-30" : ""
                } ${today ? "bg-emerald-50/50" : ""}`}
              >
                <span
                  className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-medium ${
                    today
                      ? "bg-emerald-600 text-white"
                      : "text-stone-600"
                  }`}
                >
                  {day.getDate()}
                </span>

                <div className="mt-1 space-y-0.5">
                  {dayApps.slice(0, MAX_VISIBLE).map((appt) => (
                    <div
                      key={appt.id}
                      className={`truncate rounded border-l-2 px-1.5 py-0.5 text-[10px] leading-tight ${
                        appt.status === "cancelled"
                          ? "border-l-rose-400 bg-rose-50/50 text-rose-600 line-through"
                          : appt.status === "no_show"
                            ? "border-l-amber-500 bg-amber-50/50 text-amber-700"
                            : appt.status === "completed"
                              ? "border-l-stone-400 bg-stone-50 text-stone-500"
                              : "border-l-emerald-500 bg-emerald-50/70 text-emerald-700"
                      }`}
                    >
                      {new Date(appt.starts_at).toLocaleTimeString("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      {appt.client_name?.split(" ")[0]}
                    </div>
                  ))}
                  {overflow > 0 && (
                    <p className="px-1.5 text-[10px] text-stone-400">
                      +{overflow} más
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
