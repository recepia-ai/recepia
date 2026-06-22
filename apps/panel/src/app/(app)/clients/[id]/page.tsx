import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/app/(app)/_components/status-badge";
import { relativeTime } from "../../conversations/_components/relative-time";
import {
  ArrowLeft,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  PawPrint,
  Clock,
  MapPin,
  Globe,
  ChevronRight,
  Users,
} from "lucide-react";
import type { Database } from "@recepia/db";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type PetRow = Database["public"]["Tables"]["pets"]["Row"];
type ApptRow = Database["public"]["Tables"]["appointments"]["Row"] & {
  services: { name: string; duration_minutes: number } | { name: string; duration_minutes: number }[] | null;
  pets: { name: string } | { name: string }[] | null;
};
type ConvViewRow = Database["public"]["Views"]["v_active_conversations"]["Row"];

const SPECIES_ICONS: Record<string, string> = {
  dog: "🐕",
  cat: "🐱",
  rabbit: "🐰",
  bird: "🐦",
  reptile: "🦎",
  fish: "🐟",
  ferret: "🦦",
  rodent: "🐹",
  exotic: "🦜",
  other: "🐾",
};

const SEX_LABELS: Record<string, string> = {
  male: "Macho",
  female: "Hembra",
};

function formatDateStr(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function petAge(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const now = new Date();
  const birth = new Date(birthDate);
  const years = now.getFullYear() - birth.getFullYear();
  if (years === 0) {
    const months = now.getMonth() - birth.getMonth();
    if (months <= 1) return "< 1 mes";
    return `${months} meses`;
  }
  if (years === 1) return "1 año";
  return `${years} años`;
}

function channelLabel(channel: string): string {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "phone") return "Teléfono";
  if (channel === "web") return "Web";
  return channel;
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get clinic context
  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinic_id")
    .eq("user_id", user!.id)
    .maybeSingle();

  const clinicId = (clinicUser as { clinic_id: string } | null)?.clinic_id;
  if (!clinicId) notFound();

  // 4 parallel queries
  const [clientRes, petsRes, apptsRes, convsRes] = await Promise.all([
    supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .eq("clinic_id", clinicId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("pets")
      .select("*")
      .eq("client_id", id)
      .eq("clinic_id", clinicId)
      .eq("active", true)
      .order("name", { ascending: true }),
    supabase
      .from("appointments")
      .select(
        "id, starts_at, ends_at, status, notes, pet_id, services(name, duration_minutes), pets(name)",
      )
      .eq("client_id", id)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(5),
    supabase
      .from("v_active_conversations")
      .select(
        "id, status, category, pet_name, last_message_at, channel",
      )
      .eq("client_id", id)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(5),
  ]);

  if (clientRes.error || !clientRes.data) {
    return <NotFound />;
  }

  const clientData = clientRes.data as ClientRow;
  const pets = (petsRes.data ?? []) as PetRow[];
  const appointments = (apptsRes.data ?? []) as ApptRow[];
  const conversations = (convsRes.data ?? []) as ConvViewRow[];

  const hasPhone = Boolean(clientData.phone);
  const hasEmail = Boolean(clientData.email);

  return (
    <div className="flex h-full flex-col bg-white">
      {/* ================================================================ */}
      {/* Header                                                          */}
      {/* ================================================================ */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-stone-200 px-4">
        <Link
          href="/clients"
          className="mr-1 inline-flex items-center rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 lg:hidden"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold tracking-tight text-stone-900">
            {clientData.full_name ?? "Sin nombre"}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            {hasPhone && (
              <span className="flex items-center gap-0.5">
                <Phone className="size-3" strokeWidth={1.75} />
                {clientData.phone}
              </span>
            )}
            {hasPhone && hasEmail && (
              <span className="text-stone-300">·</span>
            )}
            {hasEmail && (
              <span className="flex items-center gap-0.5">
                <Mail className="size-3" strokeWidth={1.75} />
                {clientData.email}
              </span>
            )}
            {!hasPhone && !hasEmail && (
              <span className="text-stone-400">Sin contacto</span>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" disabled>
          Editar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled
          className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
        >
          Eliminar
        </Button>
      </header>

      {/* ================================================================ */}
      {/* Scrollable content                                               */}
      {/* ================================================================ */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-6 p-6">
          {/* Client info card */}
          <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-card">
            <h3 className="text-sm font-semibold text-stone-900">
              Información del cliente
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {/* Contact */}
              <div className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">
                  Contacto
                </p>
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm text-stone-700">
                    <Phone className="size-3.5 text-stone-400" strokeWidth={1.75} />
                    {hasPhone ? clientData.phone : "—"}
                  </p>
                  <p className="flex items-center gap-2 text-sm text-stone-700">
                    <Mail className="size-3.5 text-stone-400" strokeWidth={1.75} />
                    {hasEmail ? clientData.email : "—"}
                  </p>
                  <p className="flex items-center gap-2 text-sm text-stone-700">
                    <MessageSquare
                      className="size-3.5 text-stone-400"
                      strokeWidth={1.75}
                    />
                    WhatsApp
                  </p>
                </div>
              </div>

              {/* Demographics */}
              <div className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">
                  Datos
                </p>
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm text-stone-700">
                    <MapPin className="size-3.5 text-stone-400" strokeWidth={1.75} />
                    <span className="text-stone-400">—</span>
                  </p>
                  <p className="flex items-center gap-2 text-sm text-stone-700">
                    <Globe className="size-3.5 text-stone-400" strokeWidth={1.75} />
                    {clientData.preferred_language === "en"
                      ? "Inglés"
                      : "Español"}
                  </p>
                </div>
              </div>

              {/* Metadata */}
              <div className="space-y-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">
                  Registro
                </p>
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm text-stone-700">
                    <Clock className="size-3.5 text-stone-400" strokeWidth={1.75} />
                    {formatDateStr(clientData.created_at)}
                  </p>
                  {clientData.notes && (
                    <p className="text-xs text-stone-500 italic line-clamp-3">
                      {clientData.notes}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Pets section */}
          <section>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-stone-900">
                Mascotas
              </h3>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                {pets.length}
              </span>
            </div>

            {pets.length === 0 ? (
              <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-6 py-8 text-center">
                <PawPrint
                  className="mx-auto size-5 text-stone-300"
                  strokeWidth={1.75}
                />
                <p className="mt-2 text-sm text-stone-500">
                  Este cliente no tiene mascotas registradas
                </p>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {pets.map((pet) => {
                  const speciesIcon = pet.species
                    ? SPECIES_ICONS[pet.species] ?? "🐾"
                    : "🐾";
                  const age = petAge(pet.birth_date);

                  return (
                    <div
                      key={pet.id}
                      className="rounded-xl border border-stone-200 bg-white p-4 shadow-card"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-lg">
                          {speciesIcon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-stone-900">
                            {pet.name}
                          </p>
                          <p className="mt-0.5 text-xs text-stone-500">
                            {[
                              pet.species
                                ? pet.species.charAt(0).toUpperCase() +
                                  pet.species.slice(1)
                                : null,
                              pet.breed,
                              SEX_LABELS[pet.sex] ?? null,
                              age,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {pet.chip_number && (
                            <p className="mt-1.5 text-[11px] text-stone-400">
                              Chip: {pet.chip_number}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Appointments section */}
          <section>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-stone-900">
                Próximas citas
              </h3>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                {appointments.length}
              </span>
            </div>

            {appointments.length === 0 ? (
              <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-6 py-8 text-center">
                <Calendar
                  className="mx-auto size-5 text-stone-300"
                  strokeWidth={1.75}
                />
                <p className="mt-2 text-sm text-stone-500">
                  No tiene citas próximas
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="mt-3"
                >
                  Agendar cita
                </Button>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
                {appointments.map((appt) => {
                  const service = appt.services
                    ? Array.isArray(appt.services)
                      ? appt.services[0] ?? null
                      : appt.services
                    : null;
                  const pet = appt.pets
                    ? Array.isArray(appt.pets)
                      ? appt.pets[0] ?? null
                      : appt.pets
                    : null;

                  return (
                    <div
                      key={appt.id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                        <Calendar
                          className="size-4 text-emerald-600"
                          strokeWidth={1.75}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-stone-900">
                            {formatTime(appt.starts_at)}
                          </span>
                          <span className="text-xs text-stone-500">
                            {new Date(appt.starts_at).toLocaleDateString(
                              "es-ES",
                              {
                                day: "numeric",
                                month: "short",
                              },
                            )}
                          </span>
                          <span className="text-stone-300">·</span>
                          <span className="truncate text-sm text-stone-700">
                            {service?.name ?? "Servicio"}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          {pet && (
                            <span className="text-xs text-stone-500">
                              {pet.name}
                            </span>
                          )}
                          <span className="text-xs text-stone-300">·</span>
                          <span
                            className={`text-xs font-medium ${
                              appt.status === "cancelled"
                                ? "text-rose-600"
                                : appt.status === "no_show"
                                  ? "text-amber-600"
                                  : appt.status === "completed"
                                    ? "text-stone-500"
                                    : "text-emerald-600"
                            }`}
                          >
                            {appt.status === "scheduled"
                              ? "Programada"
                              : appt.status === "confirmed"
                                ? "Confirmada"
                                : appt.status === "cancelled"
                                  ? "Cancelada"
                                  : appt.status === "no_show"
                                    ? "No asistió"
                                    : "Completada"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Conversations section */}
          <section className="pb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-stone-900">
                Conversaciones recientes
              </h3>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
                {conversations.length}
              </span>
            </div>

            {conversations.length === 0 ? (
              <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-6 py-8 text-center">
                <MessageSquare
                  className="mx-auto size-5 text-stone-300"
                  strokeWidth={1.75}
                />
                <p className="mt-2 text-sm text-stone-500">
                  Sin conversaciones todavía
                </p>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
                {conversations.map((conv) => (
                  <Link
                    key={conv.id}
                    href={`/conversations/${conv.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-stone-50"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-stone-100">
                      <MessageSquare
                        className="size-4 text-stone-500"
                        strokeWidth={1.75}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge
                          status={
                            (conv.status ?? "active") as Database["public"]["Enums"]["conversation_status"]
                          }
                        />
                        <span className="text-xs text-stone-400">
                          {channelLabel(conv.channel ?? "whatsapp")}
                        </span>
                      </div>
                      {conv.pet_name && (
                        <p className="mt-0.5 text-xs text-stone-500">
                          {conv.pet_name}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {conv.last_message_at && (
                        <span className="text-xs text-stone-400">
                          {relativeTime(conv.last_message_at)}
                        </span>
                      )}
                      <ChevronRight
                        className="size-4 text-stone-300"
                        strokeWidth={1.75}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      <div className="flex size-16 items-center justify-center rounded-full bg-rose-50">
        <Users className="size-7 text-rose-400" strokeWidth={1.75} />
      </div>
      <h3 className="mt-5 text-base font-semibold text-stone-900">
        Cliente no encontrado
      </h3>
      <p className="mt-1.5 text-sm text-stone-500">
        Este cliente no existe o no pertenece a tu clínica.
      </p>
      <Link href="/clients" className="mt-5">
        <Button variant="outline" size="sm">
          Volver a clientes
        </Button>
      </Link>
    </div>
  );
}
