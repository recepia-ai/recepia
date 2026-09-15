"use client";

import { CalendarDays, Loader2, Stethoscope, UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateVeterinarian } from "./veterinarian-actions";

export type VeterinarianItem = {
  id: string;
  user_id: string | null;
  display_name: string | null;
  email: string | null;
  role: string;
  staff_type: string | null;
  specialty_primary: string | null;
  calendar_summary: string | null;
  calendar_connected: boolean;
  calendar_sync_enabled: boolean;
  calendar_last_synced_at: string | null;
  service_count: number;
  interval_count: number;
};

function VeterinarianCard({ vet, readOnly }: { vet: VeterinarianItem; readOnly: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function submit(formData: FormData) {
    setBusy(true);
    const result = await updateVeterinarian({}, formData);
    setBusy(false);
    if (result.success) {
      toast.success("Veterinario actualizado");
      router.refresh();
    } else toast.error(result.error ?? "No se pudo actualizar");
  }
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <Stethoscope className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-stone-900">
            {vet.display_name ?? vet.email ?? "Veterinario sin nombre"}
          </h3>
          <p className="mt-0.5 text-xs text-stone-500">
            {vet.user_id ? "Acceso de usuario vinculado" : "Perfil operativo pendiente de acceso"} ·
            rol {vet.role}
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
          Perfil veterinario
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-stone-50 p-3">
          <p className="text-[10px] font-semibold uppercase text-stone-400">Servicios asignados</p>
          <p className="mt-1 text-sm font-medium">{vet.service_count || "Todos por defecto"}</p>
        </div>
        <div className="rounded-lg bg-stone-50 p-3">
          <p className="text-[10px] font-semibold uppercase text-stone-400">Intervalos semanales</p>
          <p className="mt-1 text-sm font-medium">{vet.interval_count}</p>
        </div>
        <div className="rounded-lg bg-stone-50 p-3">
          <p className="text-[10px] font-semibold uppercase text-stone-400">Google Calendar</p>
          <p className="mt-1 truncate text-sm font-medium">
            {vet.calendar_connected ? (vet.calendar_summary ?? "Asociado") : "Sin asociar"}
          </p>
          <p className="text-[11px] text-stone-500">
            {vet.calendar_connected && vet.calendar_sync_enabled
              ? "Sincronización activa"
              : "No disponible"}
          </p>
        </div>
      </div>
      <form
        action={submit}
        className="mt-4 grid gap-3 border-t border-stone-100 pt-4 sm:grid-cols-2"
      >
        <input type="hidden" name="vet_user_id" value={vet.id} />
        <div className="space-y-1.5">
          <Label>Nombre operativo</Label>
          <Input
            name="display_name"
            defaultValue={vet.display_name ?? ""}
            disabled={readOnly}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Especialidad principal</Label>
          <Input
            name="specialty_primary"
            defaultValue={vet.specialty_primary ?? ""}
            disabled={readOnly}
            placeholder="Medicina general"
          />
        </div>
        {!readOnly && (
          <div className="flex justify-end sm:col-span-2">
            <Button type="submit" size="sm" disabled={busy}>
              {busy && <Loader2 className="size-3.5 animate-spin" />}Guardar perfil
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}

export function VeterinariansManager({
  veterinarians,
  readOnly,
}: {
  veterinarians: VeterinarianItem[];
  readOnly: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Veterinarios</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Perfiles operativos basados en los miembros actuales del equipo.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/team">
              <UserRoundCheck className="size-3.5" />
              Gestionar accesos
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/integrations">
              <CalendarDays className="size-3.5" />
              Calendarios
            </Link>
          </Button>
        </div>
      </div>
      <p className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
        El modelo actual no tiene un interruptor activo/inactivo independiente. Para retirar o
        cambiar el rol de un veterinario usa Equipo; no se altera su usuario de autenticación desde
        esta pantalla.
      </p>
      <div className="space-y-3">
        {veterinarians.map((vet) => (
          <VeterinarianCard key={vet.id} vet={vet} readOnly={readOnly} />
        ))}
      </div>
      {!veterinarians.length && (
        <p className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
          No hay miembros configurados como veterinarios. Añádelos desde Equipo.
        </p>
      )}
    </div>
  );
}
