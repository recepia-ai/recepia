"use client";

import { useState } from "react";
import { AvailabilityForm } from "./_components/availability-form";
import { AvailabilityResults } from "./_components/availability-results";
import { CreateAppointmentModal } from "./_components/create-appointment-modal";
import type { AvailableSlot } from "@/app/(app)/_actions/availability-actions";
import type { ServiceOption, VetOption } from "./_schemas/test-schemas";
import type { SearchParams } from "./_components/availability-form";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  services: ServiceOption[];
  vets: VetOption[];
  defaultDateFrom: string;
  defaultDateTo: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TestAvailabilityClient({
  services,
  vets,
  defaultDateFrom,
  defaultDateTo,
}: Props) {
  const [slots, setSlots] = useState<AvailableSlot[] | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [lastParams, setLastParams] = useState<SearchParams | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  // Modal state
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Service ID from last search (needed by modal)
  const serviceId = lastParams?.service_id ?? "";

  function handleResults(slots: AvailableSlot[], params: SearchParams) {
    setSlots(slots);
    setLastParams(params);
  }

  function handleBookSlot(slot: AvailableSlot) {
    setSelectedSlot(slot);
    setModalOpen(true);
  }

  function handleSlotGone() {
    // Trigger a refetch with the last search params
    setRefetchTrigger((prev) => prev + 1);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
      {/* Left: Form */}
      <div className="lg:col-span-3">
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card sticky top-6">
          <AvailabilityForm
            services={services}
            vets={vets}
            defaultDateFrom={defaultDateFrom}
            defaultDateTo={defaultDateTo}
            onResults={handleResults}
            onBusy={setIsBusy}
            refetchTrigger={refetchTrigger}
            lastParams={lastParams}
          />
        </div>
      </div>

      {/* Right: Results */}
      <div className="lg:col-span-4">
        {isBusy ? (
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
            <div className="space-y-3 animate-pulse">
              <div className="h-4 w-24 rounded bg-stone-100" />
              <div className="h-16 rounded-lg bg-stone-100" />
              <div className="h-16 rounded-lg bg-stone-100" />
              <div className="h-16 rounded-lg bg-stone-100" />
            </div>
          </div>
        ) : slots !== null ? (
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
            <AvailabilityResults slots={slots} onBookSlot={handleBookSlot} />
          </div>
        ) : (
          <div className="rounded-xl border border-stone-200 bg-stone-50 px-6 py-16 text-center">
            <p className="text-sm text-stone-400">
              Selecciona un servicio y haz clic en &quot;Buscar disponibilidad&quot;.
            </p>
          </div>
        )}
      </div>

      {/* Modal */}
      <CreateAppointmentModal
        slot={selectedSlot}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSlotGone={handleSlotGone}
        serviceId={serviceId}
      />
    </div>
  );
}
