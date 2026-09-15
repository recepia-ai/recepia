"use client";

import { Clock3, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createConsultationInterval,
  deleteConsultationInterval,
  updateConsultationInterval,
} from "./schedule-actions";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export type ScheduleInterval = {
  id: string;
  vet_user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};
export type ScheduleVet = { id: string; name: string; intervals: ScheduleInterval[] };

function DaySelect({
  defaultValue,
  disabled = false,
}: {
  defaultValue: number;
  disabled?: boolean;
}) {
  return (
    <select
      name="day_of_week"
      defaultValue={defaultValue}
      disabled={disabled}
      className="h-9 rounded-md border border-stone-200 bg-white px-2 text-sm"
    >
      {DAYS.map((day, index) => (
        <option key={day} value={index}>
          {day}
        </option>
      ))}
    </select>
  );
}

function VetSchedule({ vet, readOnly }: { vet: ScheduleVet; readOnly: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run(
    action: () => Promise<{ success?: boolean; error?: string }>,
    success: string,
  ) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result.success) {
      toast.success(success);
      router.refresh();
    } else toast.error(result.error ?? "No se pudo guardar");
  }
  return (
    <details className="rounded-xl border border-stone-200 bg-white shadow-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">{vet.name}</h3>
          <p className="text-xs text-stone-500">{vet.intervals.length} intervalos semanales</p>
        </div>
        <Clock3 className="size-5 text-stone-300" />
      </summary>
      <div className="space-y-2 border-t border-stone-100 p-5">
        {vet.intervals.map((interval) => (
          <form
            key={interval.id}
            action={(formData) =>
              run(() => updateConsultationInterval({}, formData), "Intervalo actualizado")
            }
            className="grid items-center gap-2 rounded-lg bg-stone-50 p-2 sm:grid-cols-[1fr_110px_110px_auto]"
          >
            <input type="hidden" name="interval_id" value={interval.id} />
            <DaySelect defaultValue={interval.day_of_week} disabled={readOnly} />
            <Input
              type="time"
              name="start_time"
              defaultValue={interval.start_time.slice(0, 5)}
              disabled={readOnly}
              required
            />
            <Input
              type="time"
              name="end_time"
              defaultValue={interval.end_time.slice(0, 5)}
              disabled={readOnly}
              required
            />
            {!readOnly && (
              <div className="flex gap-1">
                <Button type="submit" size="sm" variant="outline" disabled={busy}>
                  Guardar
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Eliminar intervalo"
                  disabled={busy}
                  onClick={() =>
                    run(() => deleteConsultationInterval(interval.id), "Intervalo eliminado")
                  }
                >
                  <Trash2 className="size-3.5 text-red-600" />
                </Button>
              </div>
            )}
          </form>
        ))}
        {!vet.intervals.length && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Sin horario: este veterinario no ofrecerá huecos.
          </p>
        )}
      </div>
      {!readOnly && (
        <form
          action={(formData) =>
            run(() => createConsultationInterval({}, formData), "Intervalo añadido")
          }
          className="mx-5 mb-5 grid items-center gap-2 border-t border-stone-100 pt-3 sm:grid-cols-[1fr_110px_110px_auto]"
        >
          <input type="hidden" name="vet_user_id" value={vet.id} />
          <DaySelect defaultValue={1} />
          <Input type="time" name="start_time" defaultValue="09:00" required />
          <Input type="time" name="end_time" defaultValue="13:00" required />
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Añadir
          </Button>
        </form>
      )}
    </details>
  );
}

export function SchedulesManager({
  veterinarians,
  readOnly,
}: {
  veterinarians: ScheduleVet[];
  readOnly: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-stone-900">Horarios de consulta</h2>
        <p className="mt-0.5 text-xs text-stone-500">
          Define cuándo puede ofrecer citas cada veterinario. Puedes añadir varios intervalos por
          día.
        </p>
      </div>
      <p className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-xs text-stone-600">
        Los cambios se aplican a la próxima consulta de disponibilidad. El modelo actual representa
        desactivar un intervalo eliminándolo.
      </p>
      <div className="space-y-3">
        {veterinarians.map((vet) => (
          <VetSchedule key={vet.id} vet={vet} readOnly={readOnly} />
        ))}
      </div>
      {!veterinarians.length && (
        <p className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
          No hay veterinarios configurados.
        </p>
      )}
    </div>
  );
}
