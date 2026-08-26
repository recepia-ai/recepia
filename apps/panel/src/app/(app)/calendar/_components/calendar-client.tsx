"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { AgendaView } from "./agenda-view";
import { DayView } from "./day-view";
import { addDays, dayNameFull, isToday, mondayOf, monthName } from "./helpers";
import { MonthView } from "./month-view";
import type { AppointmentWithDetails, BusinessHours, ViewMode } from "./types";
import { WeekView } from "./week-view";

type Props = {
  appointments: AppointmentWithDetails[];
  businessHours: BusinessHours | null;
  clinicName: string;
  gestorVetConnected: boolean;
  gestorVetCount: number;
};

const VIEWS: { key: ViewMode; label: string }[] = [
  { key: "day", label: "Día" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "agenda", label: "Agenda" },
];

export function CalendarClient({
  appointments,
  businessHours,
  clinicName,
  gestorVetConnected,
  gestorVetCount,
}: Props) {
  const [view, setView] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const weekStart = useMemo(() => mondayOf(currentDate), [currentDate]);

  function goPrev() {
    setCurrentDate((d) => {
      const copy = new Date(d);
      if (view === "day") copy.setDate(copy.getDate() - 1);
      else if (view === "week") copy.setDate(copy.getDate() - 7);
      else if (view === "month") copy.setMonth(copy.getMonth() - 1);
      else copy.setDate(copy.getDate() - 1);
      return copy;
    });
  }

  function goNext() {
    setCurrentDate((d) => {
      const copy = new Date(d);
      if (view === "day") copy.setDate(copy.getDate() + 1);
      else if (view === "week") copy.setDate(copy.getDate() + 7);
      else if (view === "month") copy.setMonth(copy.getMonth() + 1);
      else copy.setDate(copy.getDate() + 1);
      return copy;
    });
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  function navigateToDay(date: Date) {
    setCurrentDate(date);
    setView("day");
  }

  // Date label for the toolbar
  const dateLabel = useMemo(() => {
    if (view === "day") {
      return `${dayNameFull(currentDate)} ${currentDate.getDate()} de ${monthName(currentDate)}`;
    }
    if (view === "week") {
      const end = addDays(weekStart, 6);
      return `${weekStart.getDate()} – ${end.getDate()} de ${monthName(end)} ${end.getFullYear()}`;
    }
    if (view === "month") {
      return `${monthName(currentDate)} ${currentDate.getFullYear()}`;
    }
    return "Próximas citas";
  }, [view, currentDate, weekStart]);

  const todayBtn = !isToday(currentDate) && view !== "agenda";

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Calendario</h1>
          <p className="mt-1 text-sm text-stone-500">Gestiona las citas de {clinicName}.</p>
        </div>
        <Button variant="outline" size="sm" disabled className="mt-1">
          <Plus className="size-4" strokeWidth={1.75} />
          Nueva cita
        </Button>
      </div>

      {gestorVetConnected && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5">
          <p className="text-xs text-violet-900">
            <span className="font-semibold">GestorVet conectado:</span> {gestorVetCount}{" "}
            {gestorVetCount === 1 ? "cita visible" : "citas visibles"} en este periodo.
          </p>
          <span className="rounded-full border border-violet-200 bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-700">
            Solo lectura
          </span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        {/* Date navigator */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8" onClick={goPrev}>
            <ChevronLeft className="size-4 text-stone-500" strokeWidth={1.75} />
          </Button>
          <span className="min-w-[180px] text-center text-sm font-medium text-stone-700">
            {dateLabel}
          </span>
          <Button variant="ghost" size="icon" className="size-8" onClick={goNext}>
            <ChevronRight className="size-4 text-stone-500" strokeWidth={1.75} />
          </Button>
          {todayBtn && (
            <Button variant="outline" size="sm" className="ml-2 h-7 text-xs" onClick={goToday}>
              Hoy
            </Button>
          )}
        </div>

        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-stone-200 bg-white p-0.5">
          {VIEWS.map((v) => (
            <button
              type="button"
              key={v.key}
              onClick={() => setView(v.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                view === v.key
                  ? "bg-stone-100 text-stone-700"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div>
        {view === "day" && (
          <DayView date={currentDate} appointments={appointments} businessHours={businessHours} />
        )}
        {view === "week" && (
          <WeekView
            weekStart={weekStart}
            appointments={appointments}
            businessHours={businessHours}
          />
        )}
        {view === "month" && (
          <MonthView date={currentDate} appointments={appointments} onDayClick={navigateToDay} />
        )}
        {view === "agenda" && <AgendaView appointments={appointments} />}
      </div>
    </div>
  );
}
