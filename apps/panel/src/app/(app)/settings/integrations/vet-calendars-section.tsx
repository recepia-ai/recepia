"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignCalendarToVet } from "./calendar-discovery-actions";
import type { VetWithCalendar } from "./calendar-discovery-actions";
import type { GoogleCalendarListItem } from "@/lib/google-calendar-types";

// ---------------------------------------------------------------------------
// VetCalendarsSection — assign Google calendars to vets (auto-save)
// ---------------------------------------------------------------------------

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}

export function VetCalendarsSection({
  vets,
  availableCalendars,
}: {
  vets: VetWithCalendar[];
  availableCalendars: GoogleCalendarListItem[];
}) {
  const [busyVetId, setBusyVetId] = useState<string | null>(null);

  const assignedCount = vets.filter((v) => v.assignedCalendarId).length;

  async function handleChange(
    vetUserId: string,
    calendarId: string | null,
  ) {
    setBusyVetId(vetUserId);
    const summary =
      availableCalendars.find((c) => c.id === calendarId)?.summary ?? null;

    const result = await assignCalendarToVet(vetUserId, calendarId, summary);

    setBusyVetId(null);

    if (result.success) {
      toast.success(
        calendarId
          ? `Calendario asignado${summary ? `: ${summary}` : ""}`
          : "Calendario quitado",
      );
      // Refresh the page so the server component re-fetches
      window.location.reload();
    } else if (result.error) {
      toast.error(result.error);
    }
  }

  if (vets.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
        <div className="flex items-start gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">
              Calendarios de veterinarios
            </h3>
            <p className="mt-0.5 text-xs text-stone-500">
              No hay veterinarios registrados en esta clínica. Añade miembros
              con tipo &quot;veterinario&quot; desde la sección Equipo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-stone-900">
            Calendarios de veterinarios
          </h3>
          <p className="mt-0.5 text-xs text-stone-500">
            Asigna un calendario de Google a cada veterinario para que el
            asistente IA pueda consultar su disponibilidad.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
          {assignedCount} de {vets.length}
        </span>
      </div>

      {/* Vet rows */}
      <div className="divide-y divide-stone-100">
        {vets.map((vet) => {
          const isBusy = busyVetId === vet.id;
          const currentValue = vet.assignedCalendarId ?? "";

          return (
            <div
              key={vet.id}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              {/* Vet info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-medium text-stone-600">
                  {initials(vet.displayName)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-900 truncate">
                    {vet.displayName ?? "Sin nombre"}
                  </p>
                  <p className="text-xs text-stone-400 truncate">
                    {vet.specialtyPrimary || "Medicina general"}
                  </p>
                </div>
              </div>

              {/* Select */}
              <div className="shrink-0 flex items-center gap-2 min-w-[200px]">
                {isBusy && (
                  <Loader2
                    className="size-3.5 animate-spin text-stone-400"
                    strokeWidth={1.75}
                  />
                )}
                <Select
                  value={currentValue}
                  onValueChange={(val) =>
                    handleChange(vet.id, val || null)
                  }
                  disabled={isBusy}
                >
                  <SelectTrigger size="sm" className="w-full justify-between">
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="">Sin asignar</SelectItem>
                    {availableCalendars.map((cal) => (
                      <SelectItem key={cal.id} value={cal.id}>
                        <span className="flex items-center gap-2">
                          {cal.backgroundColor && (
                            <span
                              className="inline-block size-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: cal.backgroundColor }}
                            />
                          )}
                          <span className="truncate max-w-[230px]">
                            {cal.summary}
                          </span>
                          {cal.primary && (
                            <span className="text-[10px] text-stone-400 shrink-0">
                              (principal)
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
