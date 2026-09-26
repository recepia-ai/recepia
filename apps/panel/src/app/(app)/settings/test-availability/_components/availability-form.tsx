"use client";

import { Loader2, Search, Syringe } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { AvailableSlot } from "@/app/(app)/_actions/availability-schemas";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ServiceOption, VetOption } from "../_schemas/test-schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SearchParams = {
  service_id: string;
  date_from: string;
  date_to: string;
  vet_user_id: string; // "" = any
};

type Props = {
  services: ServiceOption[];
  vets: VetOption[];
  defaultDateFrom: string;
  defaultDateTo: string;
  onResults: (slots: AvailableSlot[], params: SearchParams) => void;
  onBusy: (busy: boolean) => void;
  /** External trigger for refetch (e.g. after SLOT_NO_LONGER_AVAILABLE).
   *  Increment to trigger a refetch with lastParams. */
  refetchTrigger?: number;
  /** Last params from a previous successful search. */
  lastParams?: SearchParams | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AvailabilityForm({
  services,
  vets,
  defaultDateFrom,
  defaultDateTo,
  onResults,
  onBusy,
  refetchTrigger,
  lastParams,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const [serviceId, setServiceId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>(defaultDateFrom);
  const [dateTo, setDateTo] = useState<string>(defaultDateTo);
  const [vetId, setVetId] = useState<string>("");

  const selectedService = services.find((s) => s.id === serviceId);
  const isSurgery = selectedService?.is_surgery ?? false;

  // Keep lastParams in a ref so the search function always has fresh access
  const lastParamsRef = useRef(lastParams);
  lastParamsRef.current = lastParams;

  // Auto-refetch on external trigger
  const prevTriggerRef = useRef(refetchTrigger);

  // biome-ignore lint/correctness/useExhaustiveDependencies: executeSearch intentionally reads current form state and the trigger is the only refetch signal.
  useEffect(() => {
    if (
      refetchTrigger !== undefined &&
      refetchTrigger !== prevTriggerRef.current &&
      lastParamsRef.current
    ) {
      prevTriggerRef.current = refetchTrigger;
      const params = lastParamsRef.current;
      startTransition(async () => {
        if (params) await executeSearch(params);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchTrigger]);

  function buildParams(overrides?: Partial<SearchParams>): SearchParams {
    return {
      service_id: overrides?.service_id ?? serviceId,
      date_from: overrides?.date_from ?? new Date(dateFrom).toISOString(),
      date_to: overrides?.date_to ?? new Date(`${dateTo}T23:59:59`).toISOString(),
      vet_user_id: overrides?.vet_user_id ?? (vetId || ""),
    };
  }

  async function executeSearch(params: SearchParams) {
    if (!params.service_id) {
      toast.error("Selecciona un servicio.");
      return;
    }

    onBusy(true);

    const { checkAvailabilityWrapper } = await import("../_actions/test-actions");

    const result = await checkAvailabilityWrapper({
      service_id: params.service_id,
      date_from: params.date_from,
      date_to: params.date_to,
      vet_user_id: params.vet_user_id || undefined,
    });

    onBusy(false);

    if ("error" in result) {
      if (
        result.error ===
        "La conexión con Google Calendar ha expirado. Por favor, reconecta la integración."
      ) {
        toast.error("Reconecta Google Calendar en Integraciones", {
          action: {
            label: "Ir",
            onClick: () => (window.location.href = "/settings/integrations"),
          },
        });
      } else {
        toast.error(result.error);
      }
      return;
    }

    onResults(result.slots, params);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = buildParams();
    await executeSearch(params);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-900">Buscar disponibilidad</h3>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
          TEST INTERNO
        </span>
      </div>

      {/* Service select */}
      <div>
        <label
          htmlFor="availability-service"
          className="mb-1.5 block text-xs font-medium text-stone-600"
        >
          Servicio
        </label>
        <Select value={serviceId} onValueChange={setServiceId}>
          <SelectTrigger id="availability-service" className="w-full">
            <SelectValue placeholder="Selecciona un servicio…" />
          </SelectTrigger>
          <SelectContent>
            {services.map((svc) => (
              <SelectItem key={svc.id} value={svc.id}>
                <span className="flex items-center gap-2">
                  {svc.name}
                  <span className="text-xs text-stone-400">({svc.duration_minutes} min)</span>
                  {svc.is_surgery && <Syringe className="size-3 text-rose-500" />}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isSurgery && (
          <p className="mt-1 text-xs text-rose-600">
            Cirugía — la disponibilidad se limita a los veterinarios asignados al servicio.
          </p>
        )}
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="availability-from"
            className="mb-1.5 block text-xs font-medium text-stone-600"
          >
            Desde
          </label>
          <input
            id="availability-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={cn(
              "w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm",
              "focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
            disabled={isPending}
          />
        </div>
        <div>
          <label
            htmlFor="availability-to"
            className="mb-1.5 block text-xs font-medium text-stone-600"
          >
            Hasta
          </label>
          <input
            id="availability-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={cn(
              "w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm",
              "focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
            disabled={isPending}
          />
        </div>
      </div>

      {/* Vet select */}
      <div>
        <label
          htmlFor="availability-vet"
          className="mb-1.5 block text-xs font-medium text-stone-600"
        >
          Veterinario <span className="text-stone-400">(opcional)</span>
        </label>
        <Select value={vetId} onValueChange={(v) => setVetId(v)} disabled={isPending}>
          <SelectTrigger
            id="availability-vet"
            className={cn("w-full", isPending && "bg-stone-50 text-stone-500")}
          >
            <SelectValue placeholder="Cualquier vet disponible" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Cualquier vet disponible</SelectItem>
            {vets.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.display_name ?? "Sin nombre"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Submit */}
      <Button type="submit" disabled={isPending || !serviceId} className="w-full" variant="default">
        {isPending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Buscando…
          </>
        ) : (
          <>
            <Search className="mr-2 size-4" />
            Buscar disponibilidad
          </>
        )}
      </Button>
    </form>
  );
}
