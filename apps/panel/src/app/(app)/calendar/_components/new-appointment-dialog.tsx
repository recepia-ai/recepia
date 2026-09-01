"use client";

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { CalendarPlus, Loader2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { createAppointment } from "@/app/(app)/_actions/appointment-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CLINIC_TIME_ZONE } from "@/lib/clinic-datetime";
import type {
  CalendarClientOption,
  CalendarPetOption,
  CalendarServiceOption,
  CalendarVet,
} from "./types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate: Date;
  initialTime: string;
  initialVetId: string;
  clients: CalendarClientOption[];
  pets: CalendarPetOption[];
  services: CalendarServiceOption[];
  vets: CalendarVet[];
};

const selectClass =
  "h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none focus:border-emerald-500";

export function NewAppointmentDialog({
  open,
  onOpenChange,
  initialDate,
  initialTime,
  initialVetId,
  clients,
  pets,
  services,
  vets,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [clientId, setClientId] = useState("");
  const availablePets = useMemo(
    () => pets.filter((pet) => pet.client_id === clientId),
    [clientId, pets],
  );
  const dateValue = formatInTimeZone(initialDate, CLINIC_TIME_ZONE, "yyyy-MM-dd");

  function submit(formData: FormData) {
    const date = String(formData.get("date") ?? "");
    const time = String(formData.get("time") ?? "");
    const startsAt = fromZonedTime(`${date}T${time}:00`, CLINIC_TIME_ZONE).toISOString();
    startTransition(async () => {
      const result = await createAppointment({
        client_id: String(formData.get("client_id") ?? ""),
        pet_id: String(formData.get("pet_id") ?? ""),
        vet_user_id: String(formData.get("vet_user_id") ?? ""),
        service_id: String(formData.get("service_id") ?? ""),
        starts_at: startsAt,
        notes: String(formData.get("notes") ?? "") || undefined,
        created_by: "admin",
      });
      if (result.error) {
        toast.error(
          result.error === "SLOT_NO_LONGER_AVAILABLE"
            ? "Ese hueco ya no está disponible"
            : result.error,
        );
        return;
      }
      toast.success("Cita creada correctamente");
      onOpenChange(false);
      window.location.reload();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="size-5 text-emerald-700" /> Nueva cita
          </DialogTitle>
          <DialogDescription>
            La disponibilidad se vuelve a comprobar antes de guardar y sincronizar con Google
            Calendar.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha" name="date" type="date" defaultValue={dateValue} required />
            <Field
              label="Hora"
              name="time"
              type="time"
              step="900"
              defaultValue={initialTime}
              required
            />
            <SelectField label="Veterinario" name="vet_user_id" defaultValue={initialVetId}>
              <option value="" disabled>
                Selecciona veterinario
              </option>
              {vets.map((vet) => (
                <option key={vet.id} value={vet.id}>
                  {vet.name}
                </option>
              ))}
            </SelectField>
            <SelectField label="Servicio" name="service_id" defaultValue="">
              <option value="" disabled>
                Selecciona servicio
              </option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · {service.duration_minutes} min
                </option>
              ))}
            </SelectField>
            <div className="space-y-1.5">
              <Label htmlFor="appointment-client">Cliente</Label>
              <select
                id="appointment-client"
                name="client_id"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                className={selectClass}
                required
              >
                <option value="" disabled>
                  Selecciona cliente
                </option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} · {client.phone}
                  </option>
                ))}
              </select>
            </div>
            <SelectField label="Mascota" name="pet_id" defaultValue="" key={clientId}>
              <option value="" disabled>
                {clientId ? "Selecciona mascota" : "Primero selecciona cliente"}
              </option>
              {availablePets.map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="appointment-notes">Notas</Label>
            <textarea
              id="appointment-notes"
              name="notes"
              className="min-h-20 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || vets.length === 0 || services.length === 0}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {pending ? "Creando…" : "Crear cita"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}

function SelectField({
  label,
  name,
  children,
  defaultValue,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
  defaultValue: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} defaultValue={defaultValue} className={selectClass} required>
        {children}
      </select>
    </div>
  );
}
