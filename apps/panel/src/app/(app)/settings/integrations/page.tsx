import { Suspense } from "react";
import { getIntegrationStatus } from "./integration-actions";
import { GoogleCalendarCard } from "./google-calendar-card";

// ---------------------------------------------------------------------------
// Settings → Integrations Page (Server Component)
// ---------------------------------------------------------------------------

async function IntegrationContent() {
  const status = await getIntegrationStatus();
  return <GoogleCalendarCard status={status} />;
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
