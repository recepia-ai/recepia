import type { Database } from "@recepia/db";
import { ArrowRight, CalendarDays, Clock3, MessageCircle, PawPrint, UserPlus } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardAutoRefresh } from "@/app/(app)/_components/dashboard-auto-refresh";
import { StatusBadge } from "@/app/(app)/_components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  clinicDateKey,
  clinicDayBounds,
  formatClinicDate,
  formatClinicTime,
} from "@/lib/clinic-datetime";
import { readGestorVetClient } from "@/lib/gestorvet/discovery";
import { gestorVetAppointment } from "@/lib/gestorvet/native-adapters";
import { resolveOrganizationContext } from "@/lib/organization-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { relativeTime } from "./conversations/_components/relative-time";

export const maxDuration = 30;

type AppointmentRow = Pick<
  Database["public"]["Tables"]["appointments"]["Row"],
  "id" | "starts_at" | "ends_at" | "status"
> & {
  clients: { name: string } | { name: string }[] | null;
  pets: { name: string } | { name: string }[] | null;
  services: { name: string } | { name: string }[] | null;
};

type TodayAppointment = {
  id: string;
  startsAt: string;
  clientName: string;
  petName: string | null;
  serviceName: string | null;
  status: string;
  source: "recepia" | "gestorvet";
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  recepcion: "Recepción",
  veterinario: "Veterinario",
};

function single<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function firstName(displayName: string | null, email: string | null): string {
  if (displayName?.trim()) return displayName.trim().split(/\s+/)[0] ?? "";
  const local = email?.split("@")[0]?.toLowerCase() ?? "";
  if (/^(admin|clinica|hospital|info|recepcion)/.test(local)) return "";
  const candidate = local.split(/[._-]/)[0]?.match(/[a-záéíóúñ]+/i)?.[0] ?? "";
  return candidate.length >= 2
    ? candidate.charAt(0).toUpperCase() + candidate.slice(1).toLowerCase()
    : "";
}

function comparison(today: number, yesterday: number): string {
  const difference = today - yesterday;
  if (difference === 0) return "Igual que ayer";
  return `${difference > 0 ? "+" : ""}${difference} respecto a ayer`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const organizationResult = await resolveOrganizationContext(supabase);
  if (!organizationResult.ok) {
    if (organizationResult.code === "UNAUTHENTICATED") redirect("/login");
    notFound();
  }
  const { actor, organization, membership } = organizationResult.context;
  const clinicId = organization.id;
  const clinicName = organization.name;
  const todayBounds = clinicDayBounds();
  const yesterdayReference = new Date(todayBounds.start);
  yesterdayReference.setUTCDate(yesterdayReference.getUTCDate() - 1);
  const yesterdayBounds = clinicDayBounds(yesterdayReference);
  const todayKey = clinicDateKey();
  const yesterdayKey = clinicDateKey(yesterdayReference);

  const [
    conversationsToday,
    conversationsYesterday,
    appointmentsTodayResult,
    appointmentsYesterday,
    waitingConversations,
    humanConversations,
    newClients,
    recentConversations,
  ] = await Promise.all([
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .is("deleted_at", null)
      .gte("started_at", todayBounds.start.toISOString())
      .lt("started_at", todayBounds.end.toISOString()),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .is("deleted_at", null)
      .gte("started_at", yesterdayBounds.start.toISOString())
      .lt("started_at", yesterdayBounds.end.toISOString()),
    supabase
      .from("appointments")
      .select("id, starts_at, ends_at, status, clients(name), pets(name), services(name)")
      .eq("clinic_id", clinicId)
      .neq("status", "cancelled")
      .gte("starts_at", todayBounds.start.toISOString())
      .lt("starts_at", todayBounds.end.toISOString())
      .order("starts_at", { ascending: true }),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .neq("status", "cancelled")
      .gte("starts_at", yesterdayBounds.start.toISOString())
      .lt("starts_at", yesterdayBounds.end.toISOString()),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("status", "awaiting_human")
      .is("deleted_at", null),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("status", "human_handling")
      .is("deleted_at", null),
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .is("deleted_at", null)
      .gte("created_at", todayBounds.start.toISOString())
      .lt("created_at", todayBounds.end.toISOString()),
    supabase
      .from("v_conversations_inbox")
      .select(
        "id, client_name, client_phone, pet_name, status, channel, last_message_at, last_message_preview, started_at",
      )
      .eq("clinic_id", clinicId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(6),
  ]);

  const nativeAppointments: TodayAppointment[] = (
    (appointmentsTodayResult.data ?? []) as AppointmentRow[]
  ).map((appointment) => ({
    id: appointment.id,
    startsAt: appointment.starts_at,
    clientName: single(appointment.clients)?.name ?? "Cliente sin nombre",
    petName: single(appointment.pets)?.name ?? null,
    serviceName: single(appointment.services)?.name ?? null,
    status: appointment.status,
    source: "recepia",
  }));

  const gestorVetToday: TodayAppointment[] = [];
  let gestorVetYesterdayCount = 0;
  try {
    const { client } = await readGestorVetClient(createAdminClient(), clinicId);
    const records = await client.getAppointments();
    for (const record of records) {
      const appointment = gestorVetAppointment(record);
      if (!appointment) continue;
      const dateKey = clinicDateKey(appointment.startsAt);
      if (dateKey === yesterdayKey) gestorVetYesterdayCount += 1;
      if (dateKey !== todayKey) continue;
      gestorVetToday.push({
        id: `gestorvet-${appointment.externalId}`,
        startsAt: appointment.startsAt,
        clientName: appointment.clientName ?? "Cliente de GestorVet",
        petName: appointment.petName,
        serviceName: appointment.serviceName,
        status: "scheduled",
        source: "gestorvet",
      });
    }
  } catch {
    // Dashboard remains available if the optional integration is offline.
  }

  const todayAppointments = [...nativeAppointments, ...gestorVetToday].sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt),
  );
  const todayAppointmentCount = todayAppointments.length;
  const yesterdayAppointmentCount = (appointmentsYesterday.count ?? 0) + gestorVetYesterdayCount;
  const needsAttention = (waitingConversations.count ?? 0) + (humanConversations.count ?? 0);
  const metrics = [
    {
      label: "Conversaciones hoy",
      value: conversationsToday.count ?? 0,
      detail: comparison(conversationsToday.count ?? 0, conversationsYesterday.count ?? 0),
      icon: MessageCircle,
      href: "/conversations",
    },
    {
      label: "Citas hoy",
      value: todayAppointmentCount,
      detail: comparison(todayAppointmentCount, yesterdayAppointmentCount),
      icon: CalendarDays,
      href: "/calendar",
    },
    {
      label: "Necesitan atención",
      value: needsAttention,
      detail: `${waitingConversations.count ?? 0} esperando · ${humanConversations.count ?? 0} con humano`,
      icon: Clock3,
      href: "/conversations",
    },
    {
      label: "Clientes nuevos",
      value: newClients.count ?? 0,
      detail: "Registrados hoy",
      icon: UserPlus,
      href: "/clients",
    },
  ];
  const greetingName = firstName(membership.displayName, actor.email);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DashboardAutoRefresh clinicId={clinicId} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          {greetingName ? `Bienvenido, ${greetingName}` : "Bienvenido"}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Resumen del {formatClinicDate(new Date(), { day: "numeric", month: "long" })} en{" "}
          {clinicName}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Link
              key={metric.label}
              href={metric.href}
              aria-label={`${metric.label}: ${metric.value}`}
              className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              <Card className="h-full rounded-xl border-stone-200 shadow-card transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-card-hero">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <p className="text-xs font-medium uppercase tracking-wider text-stone-500">
                      {metric.label}
                    </p>
                    <Icon className="size-4 text-stone-400" strokeWidth={1.75} />
                  </div>
                  <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-stone-900">
                    {metric.value}
                  </p>
                  <p className="mt-1 text-xs text-stone-400">{metric.detail}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <Card className="rounded-xl border-stone-200 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-stone-900">
                Agenda de hoy
              </CardTitle>
              <p className="mt-1 text-xs text-stone-500">
                Recepia y GestorVet · {todayAppointmentCount} citas
              </p>
            </div>
            <Link
              href="/calendar"
              className="flex items-center gap-1 text-xs font-medium text-emerald-700"
            >
              Ver agenda <ArrowRight className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="px-0 pb-1">
            {todayAppointments.length === 0 ? (
              <p className="px-6 pb-5 text-sm text-stone-400">No hay citas programadas para hoy.</p>
            ) : (
              <div className="max-h-[420px] divide-y divide-stone-100 overflow-y-auto">
                {todayAppointments.map((appointment) => (
                  <div key={appointment.id} className="flex items-center gap-3 px-6 py-3">
                    <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-stone-900">
                      {formatClinicTime(appointment.startsAt)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-stone-900">
                        {appointment.clientName}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-stone-500">
                        {appointment.petName && <PawPrint className="size-3 shrink-0" />}
                        {[appointment.petName, appointment.serviceName]
                          .filter(Boolean)
                          .join(" · ") || "Sin detalle"}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        appointment.source === "gestorvet"
                          ? "bg-violet-50 text-violet-700"
                          : "bg-emerald-50 text-emerald-700",
                      )}
                    >
                      {appointment.source === "gestorvet" ? "GestorVet" : "Recepia"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-stone-200 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-stone-900">
                Conversaciones recientes
              </CardTitle>
              <p className="mt-1 text-xs text-stone-500">Última actividad de los clientes</p>
            </div>
            <Link
              href="/conversations"
              className="flex items-center gap-1 text-xs font-medium text-emerald-700"
            >
              Ver todas <ArrowRight className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="px-0 pb-1">
            {(recentConversations.data ?? []).length === 0 ? (
              <p className="px-6 pb-5 text-sm text-stone-400">Todavía no hay conversaciones.</p>
            ) : (
              <div className="divide-y divide-stone-100">
                {(recentConversations.data ?? []).map((conversation) => (
                  <Link
                    key={conversation.id}
                    href={`/conversations/${conversation.id}`}
                    className="block px-6 py-3 transition-colors hover:bg-stone-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-medium text-stone-900">
                        {conversation.client_name ??
                          conversation.client_phone ??
                          "Cliente sin nombre"}
                      </p>
                      {conversation.status && <StatusBadge status={conversation.status} />}
                    </div>
                    <p className="mt-1 truncate text-xs text-stone-500">
                      {conversation.pet_name ? `${conversation.pet_name} · ` : ""}
                      {conversation.last_message_preview ?? "Conversación iniciada"}
                    </p>
                    <p className="mt-1 text-[11px] text-stone-400">
                      {relativeTime(
                        conversation.last_message_at ??
                          conversation.started_at ??
                          new Date().toISOString(),
                      )}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-stone-400">
        Sesión: {ROLE_LABELS[membership.role] ?? membership.role} · Los datos se actualizan
        automáticamente.
      </p>
    </div>
  );
}
