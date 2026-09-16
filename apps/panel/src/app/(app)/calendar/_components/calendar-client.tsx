"use client";

import { ChevronLeft, ChevronRight, Plus, Stethoscope } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { AgendaView } from "./agenda-view";
import { DayView } from "./day-view";
import { addDays, dayNameFull, isToday, mondayOf, monthName } from "./helpers";
import { MonthView } from "./month-view";
import { NewAppointmentDialog } from "./new-appointment-dialog";
import type {
  AppointmentWithDetails,
  BusinessHours,
  CalendarClientOption,
  CalendarPetOption,
  CalendarServiceOption,
  CalendarVet,
  ViewMode,
} from "./types";
import { WeekView } from "./week-view";

type Props = {
  appointments: AppointmentWithDetails[];
  businessHours: BusinessHours | null;
  clinicName: string;
  gestorVetConnected: boolean;
  gestorVetCount: number;
  vets: CalendarVet[];
  clients: CalendarClientOption[];
  pets: CalendarPetOption[];
  services: CalendarServiceOption[];
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
  vets,
  clients,
  pets,
  services,
}: Props) {
  const [view, setView] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedVetId, setSelectedVetId] = useState("all");
  const [appointmentDraft, setAppointmentDraft] = useState<{ date: Date; time: string } | null>(
    null,
  );

  const weekStart = useMemo(() => mondayOf(currentDate), [currentDate]);
  const filteredAppointments = useMemo(
    () =>
      selectedVetId === "all"
        ? appointments
        : appointments.filter((appointment) => appointment.vet_user_id === selectedVetId),
    [appointments, selectedVetId],
  );

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
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Agenda</h1>
          <p className="mt-1 text-sm text-stone-500">
            Consulta y gestiona las citas de {clinicName}.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-1"
          onClick={() => setAppointmentDraft({ date: currentDate, time: "09:00" })}
        >
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
          <span className="rounded-full border border-violet-200 bg-white px-2 py-0.5 text-[10px] font-medium text-violet-700">
            Sincronizado en solo lectura
          </span>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Date navigator */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={goPrev}
            aria-label="Periodo anterior"
          >
            <ChevronLeft className="size-4 text-stone-500" strokeWidth={1.75} />
          </Button>
          <span className="min-w-[180px] text-center text-sm font-medium text-stone-700">
            {dateLabel}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={goNext}
            aria-label="Periodo siguiente"
          >
            <ChevronRight className="size-4 text-stone-500" strokeWidth={1.75} />
          </Button>
          {todayBtn && (
            <Button variant="outline" size="sm" className="ml-2 h-7 text-xs" onClick={goToday}>
              Hoy
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-8 items-center gap-2 rounded-lg border border-stone-200 bg-white px-2.5 text-xs text-stone-600">
            <Stethoscope className="size-3.5 text-emerald-700" />
            <span>Veterinario</span>
            <select
              value={selectedVetId}
              onChange={(event) => setSelectedVetId(event.target.value)}
              className="bg-transparent font-medium text-stone-800 outline-none"
            >
              <option value="all">Todos</option>
              {vets.map((vet) => (
                <option key={vet.id} value={vet.id}>
                  {vet.name}
                </option>
              ))}
            </select>
          </label>

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-stone-200 bg-white p-0.5">
            {VIEWS.map((v) => (
              <button
                type="button"
                key={v.key}
                onClick={() => setView(v.key)}
                aria-pressed={view === v.key}
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
      </div>

      {/* Content */}
      <div>
        {view === "day" && (
          <DayView
            date={currentDate}
            appointments={filteredAppointments}
            businessHours={businessHours}
            onEmptySlotClick={(date, time) => setAppointmentDraft({ date, time })}
          />
        )}
        {view === "week" && (
          <WeekView
            weekStart={weekStart}
            appointments={filteredAppointments}
            businessHours={businessHours}
            onEmptySlotClick={(date, time) => setAppointmentDraft({ date, time })}
          />
        )}
        {view === "month" && (
          <MonthView
            date={currentDate}
            appointments={filteredAppointments}
            onDayClick={navigateToDay}
          />
        )}
        {view === "agenda" && <AgendaView appointments={filteredAppointments} />}
      </div>

      {appointmentDraft && (
        <NewAppointmentDialog
          open
          onOpenChange={(open) => !open && setAppointmentDraft(null)}
          initialDate={appointmentDraft.date}
          initialTime={appointmentDraft.time}
          initialVetId={selectedVetId === "all" ? "" : selectedVetId}
          clients={clients}
          pets={pets}
          services={services}
          vets={vets}
        />
      )}
    </div>
  );
}
