import type { Database } from "@recepia/db";
import { ArrowLeft, ChevronDown, CircleAlert, MessageSquare } from "lucide-react";
import Link from "next/link";
import { CategoryBadge } from "@/app/(app)/_components/category-badge";
import { Button } from "@/components/ui/button";
import {
  escalationReasonLabel,
  isTechnicalConversationMessage,
  readEscalationDetails,
} from "@/lib/conversation-inbox";
import { resolveOrganizationContext } from "@/lib/organization-context";
import { createClient } from "@/lib/supabase/server";
import { ControlBadge } from "../_components/control-badge";
import { EmptyDetail } from "../_components/empty-detail";
import { MessageBubble } from "../_components/message-bubble";
import { CallSessionCard } from "./call-session-card";
import { ConversationAutoRefresh } from "./conversation-auto-refresh";
import { type AppointmentContext, ConversationContextPanel } from "./conversation-context-panel";
import { MessageInputBar } from "./message-input-bar";
import { ReturnToAgentButton } from "./return-to-agent-button";
import { TakeControlButton } from "./take-control-button";

type ConvRow = Database["public"]["Tables"]["conversations"]["Row"];
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type PetRow = Database["public"]["Tables"]["pets"]["Row"];
type MsgRow = Database["public"]["Tables"]["messages"]["Row"];
type CallSessionRow = Database["public"]["Tables"]["call_sessions"]["Row"];
type ChannelEventRow = Database["public"]["Tables"]["channel_events"]["Row"];
type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"] & {
  pets: { name: string } | { name: string }[] | null;
  services: { name: string } | { name: string }[] | null;
};

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

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const organizationResult = await resolveOrganizationContext(supabase);
  if (!organizationResult.ok) return <NotFound />;
  const clinicId = organizationResult.context.organization.id;

  // Fetch conversation with client and pet joins.
  const { data: conv } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!conv) {
    return <NotFound />;
  }

  const convData = conv as ConvRow;

  // Fetch client
  const { data: client } = convData.client_id
    ? await supabase
        .from("clients")
        .select("*")
        .eq("id", convData.client_id)
        .eq("clinic_id", clinicId)
        .is("deleted_at", null)
        .maybeSingle()
    : { data: null };

  // Fetch the assigned pet and every active pet belonging to the identified client.
  const [{ data: pet }, { data: clientPets }] = await Promise.all([
    convData.pet_id
      ? supabase
          .from("pets")
          .select("*")
          .eq("id", convData.pet_id)
          .eq("clinic_id", clinicId)
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    convData.client_id
      ? supabase
          .from("pets")
          .select("*")
          .eq("client_id", convData.client_id)
          .eq("clinic_id", clinicId)
          .eq("active", true)
          .is("deleted_at", null)
          .order("name", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  // Fetch messages
  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: true });

  const { data: callSessions } =
    convData.channel === "phone"
      ? await supabase
          .from("call_sessions")
          .select("*")
          .eq("conversation_id", id)
          .eq("clinic_id", clinicId)
          .order("started_at", { ascending: false })
      : { data: null };
  const callIds = (callSessions ?? []).map((call) => call.provider_call_id);
  const { data: callToolEvents } =
    callIds.length > 0
      ? await supabase
          .from("channel_events")
          .select("*")
          .eq("clinic_id", clinicId)
          .eq("provider", "vapi")
          .like("event_type", "tool-calls:%")
          .order("occurred_at", { ascending: true })
          .limit(500)
      : { data: [] };

  const { data: controller } = convData.controlled_by
    ? await supabase
        .from("clinic_users")
        .select("display_name, email")
        .eq("clinic_id", clinicId)
        .eq("user_id", convData.controlled_by)
        .maybeSingle()
    : { data: null };

  const { data: upcomingAppointments } = convData.client_id
    ? await supabase
        .from("appointments")
        .select("id, starts_at, status, vet_user_id, pets(name), services(name), updated_at")
        .eq("clinic_id", clinicId)
        .eq("client_id", convData.client_id)
        .eq("status", "confirmed")
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(5)
    : { data: [] };
  const appointmentRows = (upcomingAppointments ?? []) as AppointmentRow[];
  const appointmentVetIds = [
    ...new Set(
      appointmentRows.flatMap((appointment) =>
        appointment.vet_user_id ? [appointment.vet_user_id] : [],
      ),
    ),
  ];
  const { data: appointmentVets } =
    appointmentVetIds.length > 0
      ? await supabase
          .from("clinic_users")
          .select("id, display_name")
          .eq("clinic_id", clinicId)
          .in("id", appointmentVetIds)
      : { data: [] };
  const vetNameById = new Map(
    (appointmentVets ?? []).map((vet) => [vet.id, vet.display_name ?? "Veterinario sin nombre"]),
  );

  const clientData = client as ClientRow | null;
  const petData = pet as PetRow | null;
  const clientPetRows = (clientPets ?? []) as PetRow[];
  const msgs = (messages ?? []) as MsgRow[];
  const calls = (callSessions ?? []) as CallSessionRow[];
  const toolEvents = (callToolEvents ?? []) as ChannelEventRow[];
  const escalation = readEscalationDetails(convData.metadata);
  const primaryMessages = msgs.filter(
    (message) =>
      !isTechnicalConversationMessage({
        sender: message.sender,
        content: message.content,
        contentType: message.content_type,
      }),
  );
  const technicalMessages = msgs.filter((message) =>
    isTechnicalConversationMessage({
      sender: message.sender,
      content: message.content,
      contentType: message.content_type,
    }),
  );
  const appointmentContext: AppointmentContext[] = appointmentRows.map((appointment) => {
    const petRelation = appointment.pets
      ? Array.isArray(appointment.pets)
        ? appointment.pets[0]
        : appointment.pets
      : null;
    const serviceRelation = appointment.services
      ? Array.isArray(appointment.services)
        ? appointment.services[0]
        : appointment.services
      : null;
    return {
      id: appointment.id,
      startsAt: appointment.starts_at,
      status: appointment.status,
      petName: petRelation?.name ?? "Mascota sin identificar",
      serviceName: serviceRelation?.name ?? "Servicio sin identificar",
      vetName: appointment.vet_user_id
        ? (vetNameById.get(appointment.vet_user_id) ?? "Veterinario sin identificar")
        : "Veterinario sin identificar",
    };
  });
  const contextProps = {
    client: clientData
      ? {
          id: clientData.id,
          name: clientData.name,
          phone: clientData.phone,
          email: clientData.email,
        }
      : null,
    pets: clientPetRows.map((clientPet) => ({
      id: clientPet.id,
      name: clientPet.name,
      species: clientPet.species,
      breed: clientPet.breed,
      selected: clientPet.id === convData.pet_id,
    })),
    appointments: appointmentContext,
    channel: convData.channel,
    status: convData.status,
    controllerName: controller?.display_name ?? controller?.email ?? null,
  };
  const latestMessage = msgs.at(-1);
  const conversationVersion = [
    convData.updated_at,
    clientData?.updated_at,
    petData?.updated_at,
    ...clientPetRows.flatMap((clientPet) => [clientPet.id, clientPet.updated_at]),
    ...appointmentRows.flatMap((appointment) => [appointment.id, appointment.updated_at]),
    latestMessage?.created_at,
    latestMessage?.id,
  ]
    .filter(Boolean)
    .join(":");

  return (
    <div className="flex h-full flex-col bg-white">
      <ConversationAutoRefresh conversationId={id} initialVersion={conversationVersion} />
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-stone-200 px-4">
        <Link
          href="/conversations"
          className="mr-1 inline-flex items-center rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 lg:hidden"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-stone-900">
            {clientData ? (
              <Link
                href={`/clients/${clientData.id}`}
                className="hover:text-emerald-700 hover:underline"
              >
                {clientData.name ?? clientData.phone}
              </Link>
            ) : (
              "Cliente sin nombre"
            )}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-stone-500">
            {petData && (
              <>
                <span>
                  {petData.name}
                  {petData.species
                    ? ` (${SPECIES_ICONS[petData.species] ?? "🐾"} ${petData.species})`
                    : ""}
                </span>
                <span className="text-stone-300">·</span>
              </>
            )}
            {convData.category ? (
              <CategoryBadge category={convData.category} />
            ) : (
              <span className="text-stone-400">Sin categoría</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ControlBadge status={convData.status} />
          {convData.channel !== "phone" &&
            (convData.status === "active" || convData.status === "awaiting_human") && (
              <TakeControlButton conversationId={id} />
            )}
          {convData.status === "human_handling" && <ReturnToAgentButton conversationId={id} />}
        </div>
      </header>

      {escalation && (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" strokeWidth={2} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-amber-900">
                {escalationReasonLabel(escalation.reason)} · prioridad {escalation.urgency}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-amber-800">{escalation.summary}</p>
            </div>
            {convData.channel !== "phone" && convData.status === "awaiting_human" && (
              <TakeControlButton conversationId={id} compact />
            )}
          </div>
        </div>
      )}

      <details className="shrink-0 border-b border-stone-200 bg-stone-50 xl:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-xs font-semibold text-stone-700">
          Contexto del caso
          <ChevronDown className="size-4 text-stone-400" strokeWidth={1.75} />
        </summary>
        <ConversationContextPanel {...contextProps} />
      </details>

      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {calls.length > 0 && (
              <div className="mx-auto mb-4 max-w-3xl space-y-3">
                {calls.map((call) => {
                  const tools = toolEvents
                    .filter((event) => event.event_id.startsWith(`${call.provider_call_id}:tool:`))
                    .map((event) => {
                      const payload =
                        event.payload &&
                        typeof event.payload === "object" &&
                        !Array.isArray(event.payload)
                          ? (event.payload as Record<string, unknown>)
                          : {};
                      return {
                        id: event.id,
                        eventType: event.event_type,
                        status: event.status,
                        occurredAt: event.occurred_at,
                        input: payload.input ?? null,
                        result: event.result,
                        errorMessage: event.error_message,
                      };
                    });
                  return <CallSessionCard key={call.id} call={call} tools={tools} />;
                })}
              </div>
            )}
            {primaryMessages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <EmptyDetail />
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-3">
                {primaryMessages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    content={message.content}
                    sender={message.sender}
                    createdAt={message.created_at}
                    deliveryStatus={
                      message.metadata &&
                      typeof message.metadata === "object" &&
                      !Array.isArray(message.metadata)
                        ? String(
                            (message.metadata as Record<string, unknown>).delivery_status ?? "",
                          )
                        : undefined
                    }
                  />
                ))}

                {technicalMessages.length > 0 && (
                  <details className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-medium text-stone-500">
                      Evidencia técnica · {technicalMessages.length} eventos
                    </summary>
                    <div className="mt-2 space-y-1 border-t border-stone-200 pt-2">
                      {technicalMessages.map((message) => (
                        <p key={message.id} className="font-mono text-[10px] text-stone-500">
                          {message.content ?? "Evento técnico"}
                        </p>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>

          <MessageInputBar
            conversationId={id}
            clientName={clientData?.name ?? clientData?.phone ?? "el cliente"}
            status={convData.status}
            channel={convData.channel}
          />
        </section>

        <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-stone-200 bg-stone-50/70 xl:block">
          <ConversationContextPanel {...contextProps} />
        </aside>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      <div className="flex size-16 items-center justify-center rounded-full bg-rose-50">
        <MessageSquare className="size-7 text-rose-400" strokeWidth={1.75} />
      </div>
      <h3 className="mt-5 text-base font-semibold text-stone-900">Conversación no encontrada</h3>
      <p className="mt-1.5 text-sm text-stone-500">
        Esta conversación no existe o no pertenece a tu clínica.
      </p>
      <Link href="/conversations" className="mt-5">
        <Button variant="outline" size="sm">
          Volver a conversaciones
        </Button>
      </Link>
    </div>
  );
}
