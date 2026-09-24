"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AutomationChannel, AutomationControl } from "@/lib/automation-control";
import { setAutomationChannelState } from "./operations-actions";

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
  alerts,
  canManage,
}: {
  control: AutomationControl;
  statuses: StatusItem[];
  alerts: AlertItem[];
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
                    {alert.severity === "critical" ? "Crítica" : "Aviso"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-500">
                  {new Intl.DateTimeFormat("es-ES", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(alert.occurredAt))}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
