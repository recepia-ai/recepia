import { automationControlFromConfig } from "@/lib/automation-control";
import { getSettingsContext } from "../operations-context";
import { OperationsPanel } from "./operations-panel";

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export default async function SettingsOperationsPage() {
  const access = await getSettingsContext();
  if (!access.ok) {
    return <p className="text-sm text-red-700">{access.error}</p>;
  }

  const { supabase, clinicId, role } = access.context;
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  const [{ data: config }, { data: channels }, { data: google }, { data: alertRows }] =
    await Promise.all([
      supabase.from("clinic_config").select("config").eq("clinic_id", clinicId).maybeSingle(),
      supabase
        .from("clinic_channels")
        .select("channel_type, provider, status")
        .eq("clinic_id", clinicId),
      supabase
        .from("clinic_integrations")
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("provider", "google_calendar")
        .maybeSingle(),
      supabase
        .from("channel_events")
        .select("id, payload, occurred_at")
        .eq("clinic_id", clinicId)
        .eq("provider", "recepia-operations")
        .eq("event_type", "operational.alert")
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false })
        .limit(20),
    ]);

  const control = automationControlFromConfig(config?.config);
  const alerts = (alertRows ?? []).map((row) => {
    const payload = objectValue(row.payload);
    return {
      id: row.id,
      severity: payload.severity === "critical" ? ("critical" as const) : ("warning" as const),
      description:
        typeof payload.description === "string" ? payload.description : "Alerta operativa",
      alertId: typeof payload.alert_id === "string" ? payload.alert_id : "unknown",
      occurredAt: row.occurred_at,
    };
  });
  const activeWhatsApp = channels?.some(
    (item) => item.channel_type === "whatsapp" && item.status === "active",
  );
  const activePhone = channels?.some(
    (item) => item.channel_type === "phone" && item.provider === "vapi" && item.status === "active",
  );
  const hasRecentAlert = (id: string) => alerts.some((alert) => alert.alertId === id);

  const statuses = [
    {
      key: "web" as const,
      label: "Chat web",
      state: control.web ? ("operational" as const) : ("disabled" as const),
      detail: control.web
        ? "Recepción, Agent y tools habilitados."
        : "Inbound persistido y derivado a revisión humana; Agent bloqueado.",
    },
    {
      key: "whatsapp" as const,
      label: "WhatsApp",
      state: !control.whatsapp
        ? ("disabled" as const)
        : activeWhatsApp && !hasRecentAlert("whatsapp_outbound_failed")
          ? ("operational" as const)
          : ("degraded" as const),
      detail: !control.whatsapp
        ? "Inbound persistido; IA pausada."
        : activeWhatsApp
          ? "Canal activo; revisa alertas recientes de entrega."
          : "No existe un proveedor WhatsApp activo.",
    },
    {
      key: "phone" as const,
      label: "Voz / Vapi",
      state: !control.phone
        ? ("disabled" as const)
        : activePhone && !hasRecentAlert("vapi_assistant_request_failed")
          ? ("operational" as const)
          : ("degraded" as const),
      detail: !control.phone
        ? "Llamada registrada con assistant sin tools y revisión humana."
        : activePhone
          ? "Canal Vapi dinámico activo."
          : "No existe un canal Vapi activo.",
    },
    {
      key: "google" as const,
      label: "Google Calendar",
      state:
        google && !hasRecentAlert("google_calendar_unavailable")
          ? ("operational" as const)
          : ("degraded" as const),
      detail: google
        ? "Integración conectada; las alertas reflejan fallos recientes de lectura/escritura."
        : "Integración no conectada; no se pueden confirmar reservas seguras.",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-stone-900">Operaciones</h2>
        <p className="mt-0.5 text-xs text-stone-500">
          Control de automatización, degradación de proveedores y alertas de la clínica.
        </p>
      </div>
      <OperationsPanel
        control={control}
        statuses={statuses}
        alerts={alerts.map(({ alertId: _alertId, ...alert }) => alert)}
        canManage={role === "admin"}
      />
    </div>
  );
}
