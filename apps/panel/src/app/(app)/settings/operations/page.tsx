import { automationControlFromConfig } from "@/lib/automation-control";
import { buildPilotMetrics } from "@/lib/pilot-metrics";
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
  const statusSince = new Date(Date.now() - 30 * 60_000).toISOString();
  const metricSince = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
  const [
    { data: config },
    { data: channels },
    { data: google },
    { data: alertRows },
    { data: resolutionRows },
    { data: conversations },
    { data: calls },
    { data: tools },
    { data: appointments },
    { data: messages },
    { data: events },
    { data: signalRows },
  ] = await Promise.all([
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
      .select("id, payload, occurred_at, conversation_id, channel")
      .eq("clinic_id", clinicId)
      .eq("provider", "recepia-operations")
      .eq("event_type", "operational.alert")
      .gte("occurred_at", metricSince)
      .order("occurred_at", { ascending: false })
      .limit(50),
    supabase
      .from("channel_events")
      .select("payload")
      .eq("clinic_id", clinicId)
      .eq("provider", "recepia-operations")
      .eq("event_type", "operational.alert.resolved")
      .gte("occurred_at", metricSince),
    supabase
      .from("conversations")
      .select("id, clinic_id, channel, status, started_at, ended_at, controlled_at, metadata")
      .eq("clinic_id", clinicId)
      .is("deleted_at", null)
      .gte("started_at", metricSince)
      .order("started_at", { ascending: false })
      .limit(500),
    supabase
      .from("call_sessions")
      .select("id, clinic_id, conversation_id, duration_seconds, started_at, status")
      .eq("clinic_id", clinicId)
      .gte("started_at", metricSince)
      .order("started_at", { ascending: false })
      .limit(200),
    supabase
      .from("tool_invocations")
      .select(
        "id, clinic_id, conversation_id, tool_name, success, error_code, duration_ms, created_at",
      )
      .eq("clinic_id", clinicId)
      .gte("created_at", metricSince)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("appointments")
      .select("id, clinic_id, conversation_id, created_by, created_at")
      .eq("clinic_id", clinicId)
      .gte("created_at", metricSince)
      .limit(500),
    supabase
      .from("messages")
      .select("id, clinic_id, conversation_id, direction, sender, created_at")
      .eq("clinic_id", clinicId)
      .gte("created_at", metricSince)
      .order("created_at", { ascending: true })
      .limit(2000),
    supabase
      .from("events")
      .select("id, clinic_id, conversation_id, event_type, created_at")
      .eq("clinic_id", clinicId)
      .gte("created_at", metricSince)
      .limit(500),
    supabase
      .from("channel_events")
      .select("id, clinic_id, payload, occurred_at")
      .eq("clinic_id", clinicId)
      .eq("provider", "recepia-operations")
      .eq("event_type", "operational.signal")
      .gte("occurred_at", metricSince)
      .limit(1000),
  ]);

  const control = automationControlFromConfig(config?.config);
  const resolvedAlertIds = new Set(
    (resolutionRows ?? []).flatMap((row) => {
      const payload = objectValue(row.payload);
      return typeof payload.alert_event_id === "string" ? [payload.alert_event_id] : [];
    }),
  );
  const alerts = (alertRows ?? []).map((row) => {
    const payload = objectValue(row.payload);
    return {
      id: row.id,
      severity: payload.severity === "critical" ? ("critical" as const) : ("warning" as const),
      description:
        typeof payload.description === "string" ? payload.description : "Alerta operativa",
      alertId: typeof payload.alert_id === "string" ? payload.alert_id : "unknown",
      occurredAt: row.occurred_at,
      channel: row.channel,
      conversationId: row.conversation_id,
      errorCode: typeof payload.error_code === "string" ? payload.error_code : null,
      resolved: resolvedAlertIds.has(row.id),
    };
  });
  const activeWhatsApp = channels?.some(
    (item) => item.channel_type === "whatsapp" && item.status === "active",
  );
  const activePhone = channels?.some(
    (item) => item.channel_type === "phone" && item.provider === "vapi" && item.status === "active",
  );
  const hasRecentAlert = (id: string) =>
    alerts.some(
      (alert) =>
        alert.alertId === id &&
        !alert.resolved &&
        new Date(alert.occurredAt).getTime() >= new Date(statusSince).getTime(),
    );

  const operationalSignals = (signalRows ?? []).map((row) => {
    const payload = objectValue(row.payload);
    return {
      id: row.id,
      clinic_id: row.clinic_id,
      event: typeof payload.event === "string" ? payload.event : "unknown",
      timestamp: typeof payload.timestamp === "string" ? payload.timestamp : row.occurred_at,
    };
  });
  const metrics = buildPilotMetrics(clinicId, {
    conversations: conversations ?? [],
    calls: calls ?? [],
    tools: tools ?? [],
    appointments: appointments ?? [],
    messages: messages ?? [],
    events: events ?? [],
    operationalSignals,
  });
  const recentConversations = (conversations ?? []).slice(0, 5).map((row) => ({
    id: row.id,
    channel: row.channel,
    status: row.status,
    occurredAt: row.started_at,
  }));
  const recentCalls = (calls ?? []).slice(0, 5).map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    status: row.status,
    durationSeconds: row.duration_seconds,
    occurredAt: row.started_at,
  }));
  const recentToolFailures = (tools ?? [])
    .filter((row) => !row.success)
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      tool: row.tool_name,
      errorCode: row.error_code,
      occurredAt: row.created_at,
    }));

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
        metrics={metrics}
        alerts={alerts.map(({ alertId: _alertId, ...alert }) => alert)}
        recentConversations={recentConversations}
        recentCalls={recentCalls}
        recentToolFailures={recentToolFailures}
        canManage={role === "admin"}
      />
    </div>
  );
}
