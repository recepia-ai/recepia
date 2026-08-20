import type { Database } from "@recepia/db";
import { Clock3, Headphones, PhoneForwarded, PhoneIncoming, PhoneOutgoing } from "lucide-react";

type CallSession = Database["public"]["Tables"]["call_sessions"]["Row"];

const STATUS_LABELS: Record<string, string> = {
  queued: "En cola",
  ringing: "Sonando",
  in_progress: "En curso",
  completed: "Finalizada",
  failed: "Fallida",
  missed: "Perdida",
  transferred: "Transferida",
};

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "Duración pendiente";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes} min ${String(remainder).padStart(2, "0")} s`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function CallSessionCard({ call }: { call: CallSession }) {
  const DirectionIcon = call.direction === "inbound" ? PhoneIncoming : PhoneOutgoing;

  return (
    <section className="rounded-xl border border-sky-100 bg-sky-50/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-full bg-white text-sky-700 shadow-sm">
            <DirectionIcon className="size-4" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm font-medium text-stone-900">
              {call.direction === "inbound" ? "Llamada entrante" : "Llamada saliente"}
            </p>
            <p className="text-xs text-stone-500">{formatDate(call.started_at)}</p>
          </div>
        </div>
        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-sky-700 ring-1 ring-inset ring-sky-200">
          {STATUS_LABELS[call.status] ?? call.status}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-stone-600 sm:grid-cols-3">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="size-3.5 text-stone-400" strokeWidth={1.75} />
          {formatDuration(call.duration_seconds)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Headphones className="size-3.5 text-stone-400" strokeWidth={1.75} />
          {call.transcript_status === "completed"
            ? "Transcripción completa"
            : "Transcripción pendiente"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <PhoneForwarded className="size-3.5 text-stone-400" strokeWidth={1.75} />
          {call.status === "transferred" ? "Pasada al equipo" : "Atendida por Recepia"}
        </span>
      </div>
    </section>
  );
}
