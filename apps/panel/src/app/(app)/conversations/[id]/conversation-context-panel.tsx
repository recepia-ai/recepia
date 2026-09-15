import { CalendarDays, Mail, PawPrint, Phone } from "lucide-react";
import Link from "next/link";
import { ChannelBadge } from "../_components/channel-badge";
import { ControlBadge } from "../_components/control-badge";

type ContextClient = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
} | null;

type ContextPet = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  selected: boolean;
};

export type AppointmentContext = {
  id: string;
  startsAt: string;
  status: string;
  petName: string;
  serviceName: string;
  vetName: string;
};

function formatAppointmentDate(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ConversationContextPanel({
  client,
  pets,
  appointments,
  channel,
  status,
  controllerName,
}: {
  client: ContextClient;
  pets: ContextPet[];
  appointments: AppointmentContext[];
  channel: "web" | "whatsapp" | "phone";
  status: string;
  controllerName: string | null;
}) {
  return (
    <div className="space-y-5 p-4">
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Control</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ControlBadge status={status} />
          <ChannelBadge channel={channel} />
        </div>
        {controllerName && (
          <p className="mt-2 text-xs text-stone-500">A cargo de {controllerName}</p>
        )}
      </section>

      <section className="border-t border-stone-200 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Cliente</p>
        {client ? (
          <div className="mt-2">
            <Link
              href={`/clients/${client.id}`}
              className="text-sm font-semibold text-stone-900 hover:text-emerald-700 hover:underline"
            >
              {client.name}
            </Link>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-stone-600">
              <Phone className="size-3" strokeWidth={1.75} />
              {client.phone}
            </p>
            {client.email && (
              <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-stone-600">
                <Mail className="size-3" strokeWidth={1.75} />
                {client.email}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-stone-400">Identidad pendiente</p>
        )}
      </section>

      <section className="border-t border-stone-200 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
          Mascotas
        </p>
        <div className="mt-2 space-y-1.5">
          {pets.length > 0 ? (
            pets.map((pet) => (
              <Link
                key={pet.id}
                href={`/pets/${pet.id}`}
                className="flex items-start gap-2 rounded-lg border border-stone-200 bg-white p-2.5 transition-colors hover:border-emerald-300"
              >
                <PawPrint className="mt-0.5 size-3.5 text-stone-400" strokeWidth={1.75} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-stone-900">
                    {pet.name}
                    {pet.selected && (
                      <span className="rounded bg-emerald-50 px-1 py-0.5 text-[9px] font-semibold text-emerald-700">
                        Caso actual
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[11px] text-stone-500">
                    {[pet.species, pet.breed].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </Link>
            ))
          ) : (
            <p className="text-sm text-stone-400">Sin mascotas vinculadas</p>
          )}
        </div>
      </section>

      <section className="border-t border-stone-200 pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
            Próximas citas
          </p>
          <Link
            href="/calendar"
            className="text-[11px] font-medium text-emerald-700 hover:underline"
          >
            Ver agenda
          </Link>
        </div>
        <div className="mt-2 space-y-2">
          {appointments.length > 0 ? (
            appointments.map((appointment) => (
              <Link
                key={appointment.id}
                href="/calendar"
                className="block rounded-lg border border-stone-200 bg-white p-2.5 transition-colors hover:border-emerald-300"
              >
                <span className="flex items-center gap-1.5 text-xs font-semibold text-stone-900">
                  <CalendarDays className="size-3.5 text-emerald-600" strokeWidth={1.75} />
                  {formatAppointmentDate(appointment.startsAt)}
                </span>
                <span className="mt-1 block text-xs text-stone-600">
                  {appointment.petName} · {appointment.serviceName}
                </span>
                <span className="mt-0.5 block text-[11px] text-stone-500">
                  {appointment.vetName} · {appointment.status}
                </span>
              </Link>
            ))
          ) : (
            <p className="text-sm text-stone-400">Sin citas próximas</p>
          )}
        </div>
      </section>
    </div>
  );
}
