"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AutomationChannel, AutomationControl } from "@/lib/automation-control";
import type { PilotMetrics } from "@/lib/pilot-metrics";
import { resolveOperationalAlert, setAutomationChannelState } from "./operations-actions";

type OperationalState = "operational" | "degraded" | "disabled";

type StatusItem = {
  key: "web" | "whatsapp" | "phone" | "google";
  label: string;
  state: OperationalState;
  detail: string;
};

type AlertItem = {
  id: string;
  severity: "warning" | "critical";
  description: string;
  occurredAt: string;
  channel: "web" | "whatsapp" | "phone";
  conversationId: string | null;
  errorCode: string | null;
  resolved: boolean;
};

type RecentConversation = {
  id: string;
  channel: string;
  status: string;
  occurredAt: string;
};

type RecentCall = {
  id: string;
  conversationId: string;
  status: string;
  durationSeconds: number | null;
  occurredAt: string;
};

type RecentToolFailure = {
  id: string;
  conversationId: string | null;
  tool: string;
  errorCode: string | null;
  occurredAt: string;
};

const STATE_LABELS: Record<OperationalState, string> = {
  operational: "Operativo",
  degraded: "Degradado",
  disabled: "Desactivado",
};

const STATE_CLASSES: Record<OperationalState, string> = {
  operational: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  degraded: "bg-amber-50 text-amber-700 ring-amber-200",
  disabled: "bg-stone-100 text-stone-600 ring-stone-200",
};

export function OperationsPanel({
  control,
  statuses,
  metrics,
  alerts,
  recentConversations,
  recentCalls,
  recentToolFailures,
  canManage,
}: {
  control: AutomationControl;
  statuses: StatusItem[];
  metrics: PilotMetrics;
  alerts: AlertItem[];
  recentConversations: RecentConversation[];
  recentCalls: RecentCall[];
  recentToolFailures: RecentToolFailure[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  const toggle = (channel: AutomationChannel, enabled: boolean) => {
    const formData = new FormData();
    formData.set("channel", channel);
    formData.set("enabled", String(enabled));
    startTransition(async () => {
      const result = await setAutomationChannelState(formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success(enabled ? "IA activada" : "IA pausada y derivada al equipo");
        router.refresh();
      }
    });
  };

  const resolveAlert = (alertId: string) => {
    const formData = new FormData();
    formData.set("alert_event_id", alertId);
    startTransition(async () => {
      const result = await resolveOperationalAlert(formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Alerta marcada como resuelta");
        router.refresh();
      }
    });
  };

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(
      new Date(value),
    );
  const formatDuration = (seconds: number | null) => {
    if (seconds === null) return "—";
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  };
  const formatLatency = (milliseconds: number | null) => {
    if (milliseconds === null) return "—";
    return milliseconds < 1000 ? `${milliseconds} ms` : `${(milliseconds / 1000).toFixed(1)} s`;
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
        <h2 className="text-sm font-semibold text-stone-900">Estado operacional</h2>
        <p className="mt-1 text-xs text-stone-500">
          Estado efectivo de automatización e integraciones de esta clínica.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {statuses.map((item) => (
            <div key={item.key} className="rounded-lg border border-stone-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-stone-800">{item.label}</p>
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-medium ring-1 ${STATE_CLASSES[item.state]}`}
                >
                  {STATE_LABELS[item.state]}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-stone-500">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Métricas del piloto</h2>
            <p className="mt-1 text-xs text-stone-500">Últimos 7 días, solo esta clínica.</p>
          </div>
          <span className="text-[11px] text-stone-400">Ventana móvil · datos operativos</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Conversaciones", metrics.conversationsTotal],
            ["Web", metrics.conversationsByChannel.web],
            ["WhatsApp", metrics.conversationsByChannel.whatsapp],
            ["Llamadas", metrics.calls],
            ["Citas por IA", metrics.appointmentsCreated],
            ["Modificadas", metrics.appointmentsModified],
            ["Canceladas", metrics.appointmentsCancelled],
            ["Escalados", metrics.escalations],
            ["Takeovers", metrics.takeovers],
            ["Tools OK", metrics.toolsSucceeded],
            ["Tools fallidas", metrics.toolsFailed],
            ["Fallos assistant-request", metrics.assistantRequestFailures],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-stone-200 p-3">
              <p className="text-xs text-stone-500">{label}</p>
              <p className="mt-1 text-xl font-semibold text-stone-900">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg bg-stone-50 p-3">
            <p className="text-xs text-stone-500">Respuesta media del Agent</p>
            <p className="mt-1 text-sm font-semibold">{formatLatency(metrics.averageResponseMs)}</p>
          </div>
          <div className="rounded-lg bg-stone-50 p-3">
            <p className="text-xs text-stone-500">Duración media de llamada</p>
            <p className="mt-1 text-sm font-semibold">
              {formatDuration(metrics.averageCallDurationSeconds)}
            </p>
          </div>
          <div className="rounded-lg bg-stone-50 p-3">
            <p className="text-xs text-stone-500">Resolución automática verificable</p>
            <p className="mt-1 text-sm font-semibold">
              {metrics.automaticResolutionRate === null
                ? "—"
                : `${metrics.automaticResolutionRate}%`}
            </p>
            <p className="mt-1 text-[11px] text-stone-400">
              {metrics.automaticResolutionCount}/{metrics.automaticResolutionEligible} cerradas con
              objetivo operativo, sin escalado ni takeover.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
        <h2 className="text-sm font-semibold text-stone-900">Kill switch de IA</h2>
        <p className="mt-1 text-xs leading-5 text-stone-500">
          Pausar conserva inbound, conversaciones y evidencia, bloquea tools y deja el caso para
          revisión humana. Solo administradores pueden cambiarlo.
        </p>
        <div className="mt-4 divide-y divide-stone-100">
          {(
            [
              ["web", "Web"],
              ["whatsapp", "WhatsApp"],
              ["phone", "Voz / Vapi"],
            ] as const
          ).map(([channel, label]) => (
            <div key={channel} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium text-stone-800">IA {label}</p>
                <p className="text-xs text-stone-500">
                  {control[channel]
                    ? "Acepta automatización y tools."
                    : "Pausada; recepción trazable."}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={control[channel] ? "outline" : "default"}
                disabled={!canManage || busy}
                onClick={() => toggle(channel, !control[channel])}
              >
                {control[channel] ? "Pausar IA" : "Reactivar IA"}
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
        <h2 className="text-sm font-semibold text-stone-900">Alertas recientes</h2>
        <p className="mt-1 text-xs text-stone-500">
          Transporte persistente en Recepia, deduplicado por alerta y ventana temporal.
        </p>
        {alerts.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">No hay alertas operativas recientes.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded-lg border border-stone-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-stone-800">{alert.description}</p>
                  <span
                    className={
                      alert.severity === "critical"
                        ? "text-xs text-red-700"
                        : "text-xs text-amber-700"
                    }
                  >
                    {alert.resolved
                      ? "Resuelta"
                      : alert.severity === "critical"
                        ? "Crítica · abierta"
                        : "Aviso · abierto"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  {formatDate(alert.occurredAt)} · {alert.channel}
                  {alert.errorCode ? ` · ${alert.errorCode}` : ""}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  {alert.conversationId && (
                    <Link
                      href={`/conversations/${alert.conversationId}`}
                      className="text-xs font-medium text-emerald-700 hover:underline"
                    >
                      Abrir conversación
                    </Link>
                  )}
                  {!alert.resolved && canManage && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => resolveAlert(alert.id)}
                    >
                      Marcar resuelta
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
          <h2 className="text-sm font-semibold text-stone-900">Últimas conversaciones</h2>
          <div className="mt-3 space-y-2">
            {recentConversations.length === 0 ? (
              <p className="text-xs text-stone-500">Sin actividad en la ventana.</p>
            ) : (
              recentConversations.map((row) => (
                <Link
                  key={row.id}
                  href={`/conversations/${row.id}`}
                  className="block rounded-lg border border-stone-100 p-2 text-xs hover:bg-stone-50"
                >
                  <span className="font-medium text-stone-800">{row.channel}</span>
                  <span className="text-stone-500">
                    {" "}
                    · {row.status} · {formatDate(row.occurredAt)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
          <h2 className="text-sm font-semibold text-stone-900">Últimas llamadas</h2>
          <div className="mt-3 space-y-2">
            {recentCalls.length === 0 ? (
              <p className="text-xs text-stone-500">Sin llamadas en la ventana.</p>
            ) : (
              recentCalls.map((row) => (
                <Link
                  key={row.id}
                  href={`/conversations/${row.conversationId}`}
                  className="block rounded-lg border border-stone-100 p-2 text-xs hover:bg-stone-50"
                >
                  <span className="font-medium text-stone-800">{row.status}</span>
                  <span className="text-stone-500">
                    {" "}
                    · {formatDuration(row.durationSeconds)} · {formatDate(row.occurredAt)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
          <h2 className="text-sm font-semibold text-stone-900">Fallos de tools recientes</h2>
          <div className="mt-3 space-y-2">
            {recentToolFailures.length === 0 ? (
              <p className="text-xs text-stone-500">Sin fallos en la ventana.</p>
            ) : (
              recentToolFailures.map((row) => {
                const content = (
                  <>
                    <span className="font-medium text-stone-800">{row.tool}</span>
                    <span className="text-stone-500">
                      {" "}
                      · {row.errorCode ?? "TOOL_FAILED"} · {formatDate(row.occurredAt)}
                    </span>
                  </>
                );
                return row.conversationId ? (
                  <Link
                    key={row.id}
                    href={`/conversations/${row.conversationId}`}
                    className="block rounded-lg border border-stone-100 p-2 text-xs hover:bg-stone-50"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={row.id} className="rounded-lg border border-stone-100 p-2 text-xs">
                    {content}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
