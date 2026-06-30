"use client";

import { Calendar, Clock, Syringe, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AvailableSlot } from "@/app/(app)/_actions/availability-schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  slots: AvailableSlot[];
  onBookSlot: (slot: AvailableSlot) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return "Hoy";
  if (d.toDateString() === tomorrow.toDateString()) return "Mañana";

  return d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function durationMinutes(startsAt: string, endsAt: string): number {
  return Math.round(
    (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000,
  );
}

/** Group slots by YYYY-MM-DD (local date) */
function groupByDate(slots: AvailableSlot[]): Map<string, AvailableSlot[]> {
  const map = new Map<string, AvailableSlot[]>();
  for (const s of slots) {
    const key = new Date(s.starts_at).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AvailabilityResults({ slots, onBookSlot }: Props) {
  if (slots.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 px-6 py-10 text-center">
        <Calendar className="mx-auto size-6 text-stone-300" strokeWidth={1.5} />
        <p className="mt-3 text-sm font-medium text-stone-500">
          No hay disponibilidad en el rango seleccionado
        </p>
        <p className="mt-1 text-xs text-stone-400">
          Prueba con otro servicio, fechas o veterinario.
        </p>
      </div>
    );
  }

  const grouped = groupByDate(slots);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-900">Resultados</h3>
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-500">
          {slots.length} slot{slots.length !== 1 ? "s" : ""}
        </span>
      </div>

      {Array.from(grouped.entries()).map(([dateKey, daySlots]) => {
        const label = formatDate(daySlots[0]!.starts_at);

        return (
          <div key={dateKey}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
              {label}
            </p>
            <div className="space-y-1.5">
              {daySlots.map((slot, i) => {
                const isSamuel = slot.vet_name.toLowerCase().includes("samuel");
                const dur = durationMinutes(slot.starts_at, slot.ends_at);

                return (
                  <div
                    key={`${slot.vet_user_id}-${slot.starts_at}-${i}`}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5",
                      isSamuel
                        ? "border-rose-200 bg-rose-50/50"
                        : "border-stone-200 bg-white",
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium",
                          isSamuel
                            ? "bg-rose-100 text-rose-700"
                            : "bg-stone-100 text-stone-600",
                        )}
                      >
                        {slot.vet_name
                          .split(" ")
                          .map((p) => p.charAt(0))
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-sm font-medium text-stone-900 truncate">
                          {slot.vet_name}
                          {isSamuel && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                              <Syringe className="size-2.5" />
                              Cirugía
                            </span>
                          )}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-stone-500">
                          <Clock className="size-3" strokeWidth={1.5} />
                          {formatTime(slot.starts_at)} —{" "}
                          {formatTime(slot.ends_at)}
                          <span className="text-stone-300">·</span>
                          {dur} min
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => onBookSlot(slot)}
                    >
                      Crear cita
                      <ChevronRight className="ml-1 size-3.5" />
                    </Button>
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
