import type { Database } from "@recepia/db";
import {
  CalendarCheck,
  Clock3,
  Headphones,
  PhoneForwarded,
  PhoneIncoming,
  PhoneOutgoing,
  Wrench,
} from "lucide-react";

type CallSession = Database["public"]["Tables"]["call_sessions"]["Row"];
type ToolEvidence = {
  id: string;
  eventType: string;
  status: string;
  occurredAt: string;
  input: unknown;
  result: unknown;
  errorMessage: string | null;
};

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

export function CallSessionCard({
  call,
  tools = [],
}: {
  call: CallSession;
  tools?: ToolEvidence[];
}) {
  const DirectionIcon = call.direction === "inbound" ? PhoneIncoming : PhoneOutgoing;
  const metadata =
    call.metadata && typeof call.metadata === "object" && !Array.isArray(call.metadata)
      ? (call.metadata as Record<string, unknown>)
      : {};
  const transcript = typeof metadata.transcript === "string" ? metadata.transcript : null;
  const summary = typeof metadata.summary === "string" ? metadata.summary : null;
  const appointmentCreated = tools.some((tool) => {
    const serialized = JSON.stringify(tool.result);
    return tool.eventType.endsWith(":create_appointment") && serialized.includes("appointment_id");
  });

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

      <div className="mt-3 flex items-center gap-1.5 text-xs text-stone-600">
        <CalendarCheck className="size-3.5 text-stone-400" strokeWidth={1.75} />
        {appointmentCreated ? "Cita creada durante la llamada" : "Sin cita creada"}
      </div>

      {summary && (
        <div className="mt-3 rounded-lg border border-sky-100 bg-white p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            Resumen
          </p>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-stone-700">{summary}</p>
        </div>
      )}

      {transcript && (
        <details className="mt-3 rounded-lg border border-sky-100 bg-white p-3">
          <summary className="cursor-pointer text-xs font-semibold text-stone-700">
            Transcript completo
          </summary>
          <p className="mt-2 whitespace-pre-wrap border-t border-stone-100 pt-2 text-xs leading-5 text-stone-600">
            {transcript}
          </p>
        </details>
      )}

      {tools.length > 0 && (
        <details className="mt-3 rounded-lg border border-sky-100 bg-white p-3">
          <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-stone-700">
            <Wrench className="size-3.5" strokeWidth={1.75} />
            Tools y resultados · {tools.length}
          </summary>
          <div className="mt-2 space-y-2 border-t border-stone-100 pt-2">
            {tools.map((tool) => (
              <div key={tool.id} className="rounded-md bg-stone-50 p-2 text-[11px] text-stone-600">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-stone-700">
                    {tool.eventType.replace("tool-calls:", "")}
                  </span>
                  <span>
                    {formatDate(tool.occurredAt)} · {tool.status}
                  </span>
                </div>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-[10px]">
                  {JSON.stringify(
                    { input: tool.input, result: tool.result, error: tool.errorMessage },
                    null,
                    2,
                  )}
                </pre>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
