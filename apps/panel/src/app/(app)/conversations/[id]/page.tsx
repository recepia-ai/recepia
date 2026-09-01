import type { Database } from "@recepia/db";
import { ArrowLeft, Mail, MessageSquare, PawPrint, Phone } from "lucide-react";
import Link from "next/link";
import { CategoryBadge } from "@/app/(app)/_components/category-badge";
import { StatusBadge } from "@/app/(app)/_components/status-badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ChannelBadge } from "../_components/channel-badge";
import { EmptyDetail } from "../_components/empty-detail";
import { MessageBubble } from "../_components/message-bubble";
import { CallSessionCard } from "./call-session-card";
import { ConversationAutoRefresh } from "./conversation-auto-refresh";
import { MessageInputBar } from "./message-input-bar";
import { ReturnToAgentButton } from "./return-to-agent-button";
import { TakeControlButton } from "./take-control-button";

type ConvRow = Database["public"]["Tables"]["conversations"]["Row"];
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type PetRow = Database["public"]["Tables"]["pets"]["Row"];
type MsgRow = Database["public"]["Tables"]["messages"]["Row"];
type CallSessionRow = Database["public"]["Tables"]["call_sessions"]["Row"];

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

  // Fetch conversation with client and pet joins.
  const { data: conv } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!conv) {
    return <NotFound />;
  }

  const convData = conv as ConvRow;

  // Fetch client
  const { data: client } = convData.client_id
    ? await supabase.from("clients").select("*").eq("id", convData.client_id).maybeSingle()
    : { data: null };

  // Fetch the assigned pet and every active pet belonging to the identified client.
  const [{ data: pet }, { data: clientPets }] = await Promise.all([
    convData.pet_id
      ? supabase.from("pets").select("*").eq("id", convData.pet_id).maybeSingle()
      : Promise.resolve({ data: null }),
    convData.client_id
      ? supabase
          .from("pets")
          .select("*")
          .eq("client_id", convData.client_id)
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
    .order("created_at", { ascending: true });

  const { data: callSessions } =
    convData.channel === "phone"
      ? await supabase
          .from("call_sessions")
          .select("*")
          .eq("conversation_id", id)
          .order("started_at", { ascending: false })
      : { data: null };

  const { data: controller } = convData.controlled_by
    ? await supabase
        .from("clinic_users")
        .select("display_name, email")
        .eq("clinic_id", convData.clinic_id)
        .eq("user_id", convData.controlled_by)
        .maybeSingle()
    : { data: null };

  const clientData = client as ClientRow | null;
  const petData = pet as PetRow | null;
  const clientPetRows = (clientPets ?? []) as PetRow[];
  const msgs = (messages ?? []) as MsgRow[];
  const calls = (callSessions ?? []) as CallSessionRow[];
  const latestMessage = msgs.at(-1);
  const conversationVersion = [
    convData.updated_at,
    clientData?.updated_at,
    petData?.updated_at,
    ...clientPetRows.flatMap((clientPet) => [clientPet.id, clientPet.updated_at]),
    latestMessage?.created_at,
    latestMessage?.id,
  ]
    .filter(Boolean)
    .join(":");

  const hasPhone = Boolean(clientData?.phone);
  const hasEmail = Boolean(clientData?.email);
  const hasContactInfo = hasPhone || hasEmail;

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
          {convData.channel !== "phone" &&
            (convData.status === "active" || convData.status === "awaiting_human") && (
              <TakeControlButton conversationId={id} />
            )}
          {convData.status === "human_handling" && <ReturnToAgentButton conversationId={id} />}
        </div>
      </header>

      {/* Meta info */}
      <div className="shrink-0 space-y-4 border-b border-stone-100 bg-stone-50 px-6 py-4">
        <div className="grid grid-cols-3 gap-6">
          {/* Client info */}
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">
              Cliente
            </p>
            <p className="mt-1 text-sm font-medium text-stone-900">{clientData?.name ?? "—"}</p>
            {clientData && (
              <Link
                href={`/clients/${clientData.id}`}
                className="mt-1 inline-flex text-[11px] font-medium text-emerald-700 hover:underline"
              >
                Ver ficha del cliente
              </Link>
            )}
            {hasContactInfo && (
              <div className="mt-1 space-y-0.5">
                {clientData?.phone && (
                  <p className="flex items-center gap-1 text-xs text-stone-500">
                    <Phone className="size-3" strokeWidth={1.75} />
                    {clientData.phone}
                  </p>
                )}
                {clientData?.email && (
                  <p className="flex items-center gap-1 text-xs text-stone-500">
                    <Mail className="size-3" strokeWidth={1.75} />
                    {clientData.email}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Client pets */}
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">
              Mascotas del cliente
            </p>
            {clientPetRows.length > 0 ? (
              <div className="mt-1.5 space-y-1.5">
                {clientPetRows.map((clientPet) => (
                  <Link
                    key={clientPet.id}
                    href={`/pets/${clientPet.id}`}
                    className="block rounded-md border border-stone-200 bg-white px-2.5 py-2 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40"
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium text-stone-900">
                      <PawPrint className="size-3.5 text-stone-400" strokeWidth={1.75} />
                      {clientPet.name}
                      {clientPet.id === convData.pet_id && (
                        <span className="ml-auto text-[10px] font-medium text-emerald-700">
                          En esta conversación
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-stone-500">
                      {[clientPet.species, clientPet.breed].filter(Boolean).join(" · ")}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm text-stone-400">Sin mascotas vinculadas</p>
            )}
          </div>

          {/* Conversation status */}
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">
              Conversación
            </p>
            <div className="mt-1 space-y-1.5">
              <StatusBadge status={convData.status} />
              <ChannelBadge channel={convData.channel} />
              {controller && (
                <p className="text-xs text-stone-500">
                  En control: {controller.display_name ?? controller.email ?? "miembro del equipo"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages timeline */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {calls.length > 0 && (
          <div className="mx-auto mb-4 max-w-3xl space-y-3">
            {calls.map((call) => (
              <CallSessionCard key={call.id} call={call} />
            ))}
          </div>
        )}
        {msgs.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyDetail />
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-3">
            {msgs.map((m) => (
              <MessageBubble
                key={m.id}
                content={m.content}
                sender={m.sender}
                createdAt={m.created_at}
                deliveryStatus={
                  m.metadata && typeof m.metadata === "object" && !Array.isArray(m.metadata)
                    ? String((m.metadata as Record<string, unknown>).delivery_status ?? "")
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Input bar */}
      <MessageInputBar
        conversationId={id}
        clientName={clientData?.name ?? clientData?.phone ?? "el cliente"}
        status={convData.status}
        channel={convData.channel}
      />
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
