import { cn } from "@/lib/utils";
import type { AppointmentWithDetails } from "./types";

const STATUS_STYLES: Record<
  AppointmentWithDetails["status"],
  { border: string; label: string }
> = {
  scheduled: {
    border: "border-l-emerald-500",
    label: "Programada",
  },
  confirmed: {
    border: "border-l-emerald-600",
    label: "Confirmada",
  },
  cancelled: {
    border: "border-l-rose-400",
    label: "Cancelada",
  },
  no_show: {
    border: "border-l-amber-500",
    label: "No asistió",
  },
  completed: {
    border: "border-l-stone-400",
    label: "Completada",
  },
};

type Variant = "compact" | "default" | "expanded";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

type Props = {
  appointment: AppointmentWithDetails;
  variant?: Variant;
  className?: string;
};

export function AppointmentCard({
  appointment,
  variant = "default",
  className,
}: Props) {
  const isCancelled = appointment.status === "cancelled";
  const styles = STATUS_STYLES[appointment.status];

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "h-full overflow-hidden rounded-md border border-stone-200 bg-white px-2 py-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
          styles.border,
          "border-l-2",
          isCancelled && "opacity-60",
          className,
        )}
      >
        <div className="flex items-center gap-1 min-w-0">
          <span
            className={cn(
              "shrink-0 text-[11px] font-medium",
              isCancelled ? "text-stone-400 line-through" : "text-stone-700",
            )}
          >
            {formatTime(appointment.starts_at)}
          </span>
          <span className="truncate text-[11px] text-stone-600">
            {appointment.client_name ?? appointment.client_phone ?? "—"}
          </span>
        </div>
        {appointment.service_name && (
          <p className="mt-0.5 truncate text-[10px] leading-tight text-stone-400">
            {appointment.service_name}
          </p>
        )}
      </div>
    );
  }

  if (variant === "expanded") {
    return (
      <div
        className={cn(
          "rounded-lg border border-stone-200 bg-white p-4 transition-shadow hover:shadow-card-hero",
          styles.border,
          "border-l-4",
          isCancelled && "opacity-60",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-stone-900">
                {formatTime(appointment.starts_at)} –{" "}
                {formatTime(appointment.ends_at)}
              </span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  isCancelled
                    ? "bg-rose-50 text-rose-600"
                    : "bg-stone-100 text-stone-600",
                )}
              >
                {styles.label}
              </span>
            </div>
            <p className="text-sm font-medium text-stone-900">
              {appointment.client_name ?? appointment.client_phone ?? "Sin nombre"}
            </p>
            {(appointment.pet_name || appointment.service_name) && (
              <p className="text-xs text-stone-500">
                {[
                  appointment.pet_name,
                  appointment.service_name,
                  appointment.service_duration_minutes
                    ? `${appointment.service_duration_minutes} min`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {appointment.notes && (
              <p className="text-xs text-stone-400 italic line-clamp-2">
                {appointment.notes}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // default variant
  return (
    <div
      className={cn(
        "rounded-lg border border-stone-200 bg-white p-3 transition-shadow hover:shadow-card-hero",
        styles.border,
        "border-l-4",
        isCancelled && "opacity-60",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-stone-500">
            {formatTime(appointment.starts_at)}
            {appointment.service_duration_minutes
              ? ` · ${appointment.service_duration_minutes} min`
              : ""}
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-stone-900">
            {appointment.client_name ?? "—"}
          </p>
          {appointment.pet_name && (
            <p className="mt-0.5 truncate text-xs text-stone-500">
              {appointment.pet_name}
              {appointment.service_name
                ? ` · ${appointment.service_name}`
                : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export { formatTime, formatDate };
