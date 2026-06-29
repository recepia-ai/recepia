import { Suspense } from "react";
import { getIntegrationStatus } from "./integration-actions";
import { GoogleCalendarCard } from "./google-calendar-card";
import { listGoogleCalendars, listVetsWithCalendars } from "./calendar-discovery-actions";
import { VetCalendarsSection } from "./vet-calendars-section";

// ---------------------------------------------------------------------------
// Settings → Integrations Page (Server Component)
// ---------------------------------------------------------------------------

async function IntegrationContent() {
  const status = await getIntegrationStatus();

  // If connected, also load calendar discovery data
  let calendarsData:
    | { calendars: import("@/lib/google-calendar-types").GoogleCalendarListItem[] }
    | { error: string }
    | null = null;
  let vetsData:
    | { vets: import("./calendar-discovery-actions").VetWithCalendar[] }
    | { error: string }
    | null = null;

  if (status.connected) {
    const [calendarsResult, vetsResult] = await Promise.all([
      listGoogleCalendars(),
      listVetsWithCalendars(),
    ]);
    calendarsData = calendarsResult;
    vetsData = vetsResult;
  }

  return (
    <div className="space-y-5">
      <GoogleCalendarCard status={status} />

      {status.connected && calendarsData && vetsData && (
        <>
          {"error" in calendarsData ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm font-medium text-amber-800">
                No se pudieron cargar los calendarios
              </p>
              <p className="mt-1 text-xs text-amber-600">
                {calendarsData.error === "REAUTH_REQUIRED"
                  ? "La conexión con Google Calendar ha expirado. Reconecta la integración."
                  : calendarsData.error}
              </p>
            </div>
          ) : (
            <>
              {"error" in vetsData ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                  <p className="text-sm font-medium text-amber-800">
                    No se pudieron cargar los veterinarios
                  </p>
                  <p className="mt-1 text-xs text-amber-600">{vetsData.error}</p>
                </div>
              ) : (
                <VetCalendarsSection
                  vets={vetsData.vets}
                  availableCalendars={calendarsData.calendars}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function SettingsIntegrationsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-stone-900">Integraciones</h2>
        <p className="mt-0.5 text-xs text-stone-500">
          Conecta servicios externos para ampliar las capacidades del asistente IA.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
            <div className="h-20 animate-pulse rounded-lg bg-stone-100" />
          </div>
        }
      >
        <IntegrationContent />
      </Suspense>
    </div>
  );
}
