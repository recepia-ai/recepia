"use client";

import { Loader2, Plus, Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createService,
  saveServiceAssignments,
  setServiceActive,
  updateService,
} from "./service-actions";

export type ServiceVet = { id: string; name: string };
export type ServiceItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  duration_minutes: number;
  price_min_cents: number | null;
  price_max_cents: number | null;
  is_surgery: boolean;
  requires_fasting: boolean;
  escalates_for_pricing: boolean;
  requires_specific_vet_user_id: string | null;
  active: boolean;
  sort_order: number;
  assigned_vet_ids: string[];
};

function price(cents: number | null) {
  return cents === null ? "" : (cents / 100).toFixed(2);
}

function ServiceFields({ service }: { service?: ServiceItem }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {service && <input type="hidden" name="service_id" value={service.id} />}
      <div className="space-y-1.5 md:col-span-2">
        <Label>Nombre</Label>
        <Input name="name" defaultValue={service?.name} required minLength={2} maxLength={120} />
      </div>
      <div className="space-y-1.5 md:col-span-2">
        <Label>Descripción para recepción</Label>
        <Input name="description" defaultValue={service?.description ?? ""} maxLength={600} />
      </div>
      <div className="space-y-1.5">
        <Label>Duración (minutos)</Label>
        <Input
          name="duration_minutes"
          type="number"
          min={5}
          max={480}
          defaultValue={service?.duration_minutes ?? 30}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>Precio mín. (€)</Label>
          <Input
            name="price_min"
            inputMode="decimal"
            defaultValue={price(service?.price_min_cents ?? null)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Precio máx. (€)</Label>
          <Input
            name="price_max"
            inputMode="decimal"
            defaultValue={price(service?.price_max_cents ?? null)}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-4 md:col-span-2">
        {[
          ["is_surgery", "Es cirugía", service?.is_surgery],
          ["requires_fasting", "Requiere ayuno", service?.requires_fasting],
          ["escalates_for_pricing", "Precio lo confirma el equipo", service?.escalates_for_pricing],
        ].map(([name, label, checked]) => (
          <label key={String(name)} className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              name={String(name)}
              value="true"
              defaultChecked={Boolean(checked)}
              className="size-4 accent-emerald-600"
            />
            {String(label)}
          </label>
        ))}
      </div>
    </div>
  );
}

function ServiceCard({
  service,
  vets,
  readOnly,
}: {
  service: ServiceItem;
  vets: ServiceVet[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [selectedVets, setSelectedVets] = useState(service.assigned_vet_ids);

  async function submit(formData: FormData) {
    setBusy(true);
    const result = await updateService({}, formData);
    setBusy(false);
    if (result.success) {
      toast.success("Servicio actualizado");
      router.refresh();
    } else toast.error(result.error ?? "No se pudo guardar");
  }

  async function toggleActive() {
    setBusy(true);
    const result = await setServiceActive(service.id, !service.active);
    setBusy(false);
    if (result.success) {
      toast.success(service.active ? "Servicio desactivado" : "Servicio activado");
      router.refresh();
    } else toast.error(result.error ?? "No se pudo cambiar el estado");
  }

  async function saveAssignments() {
    setBusy(true);
    const result = await saveServiceAssignments(service.id, selectedVets);
    setBusy(false);
    if (result.success) {
      toast.success("Profesionales actualizados");
      router.refresh();
    } else toast.error(result.error ?? "No se pudieron guardar las asignaciones");
  }

  return (
    <details className="rounded-xl border border-stone-200 bg-white shadow-card">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4">
        <span
          className={`size-2 rounded-full ${service.active ? "bg-emerald-500" : "bg-stone-300"}`}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-stone-900">
            {service.name}
          </span>
          <span className="block text-xs text-stone-500">
            {service.duration_minutes} min ·{" "}
            {service.assigned_vet_ids.length
              ? `${service.assigned_vet_ids.length} profesionales`
              : "Todos los veterinarios"}
          </span>
        </span>
        <span
          className={`rounded-full px-2 py-1 text-[11px] font-medium ${service.active ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}
        >
          {service.active ? "Activo" : "Inactivo"}
        </span>
      </summary>
      <div className="space-y-5 border-t border-stone-100 p-5">
        {readOnly ? (
          <p className="text-sm text-stone-500">Solo un administrador puede editar servicios.</p>
        ) : (
          <>
            <form action={submit} className="space-y-4">
              <ServiceFields service={service} />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleActive}
                  disabled={busy}
                >
                  <Power className="size-3.5" /> {service.active ? "Desactivar" : "Activar"}
                </Button>
                <Button type="submit" size="sm" disabled={busy}>
                  {busy && <Loader2 className="size-3.5 animate-spin" />}Guardar servicio
                </Button>
              </div>
            </form>
            <section className="border-t border-stone-100 pt-4">
              <h4 className="text-sm font-semibold text-stone-900">Quién puede realizarlo</h4>
              <p className="mt-0.5 text-xs text-stone-500">
                Sin selección, la disponibilidad considera a todos los veterinarios. Un profesional
                obligatorio configurado previamente tiene prioridad.
              </p>
              {service.requires_specific_vet_user_id && (
                <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Este servicio tiene un veterinario obligatorio; las demás asignaciones no cambian
                  la disponibilidad.
                </p>
              )}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {vets.map((vet) => (
                  <label
                    key={vet.id}
                    className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedVets.includes(vet.id)}
                      onChange={(event) =>
                        setSelectedVets((current) =>
                          event.target.checked
                            ? [...current, vet.id]
                            : current.filter((id) => id !== vet.id),
                        )
                      }
                      className="size-4 accent-emerald-600"
                    />
                    {vet.name}
                  </label>
                ))}
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={saveAssignments}
                  disabled={busy}
                >
                  Guardar profesionales
                </Button>
              </div>
            </section>
          </>
        )}
      </div>
    </details>
  );
}

export function ServicesManager({
  services,
  vets,
  readOnly,
}: {
  services: ServiceItem[];
  vets: ServiceVet[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function submit(formData: FormData) {
    setBusy(true);
    const result = await createService({}, formData);
    setBusy(false);
    if (result.success) {
      toast.success("Servicio creado");
      router.refresh();
    } else toast.error(result.error ?? "No se pudo crear");
  }
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-stone-900">Servicios</h2>
        <p className="mt-0.5 text-xs text-stone-500">
          Configura el catálogo que utilizan recepción y el asistente de la clínica.
        </p>
      </div>
      {!readOnly && (
        <details className="rounded-xl border border-emerald-200 bg-emerald-50/40">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-semibold text-emerald-800">
            <Plus className="size-4" />
            Crear servicio
          </summary>
          <form action={submit} className="space-y-4 border-t border-emerald-100 bg-white p-5">
            <ServiceFields />
            <div className="flex justify-end">
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}Crear servicio
              </Button>
            </div>
          </form>
        </details>
      )}
      <div className="space-y-3">
        {services.map((service) => (
          <ServiceCard key={service.id} service={service} vets={vets} readOnly={readOnly} />
        ))}
      </div>
      {!services.length && (
        <p className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
          Todavía no hay servicios.
        </p>
      )}
    </div>
  );
}
