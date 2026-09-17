import type { Database } from "@recepia/db";
import { redirect } from "next/navigation";
import { resolveOrganizationContext } from "@/lib/organization-context";
import { createClient } from "@/lib/supabase/server";
import { ConversationsList } from "./_components/conversations-list";

type ConversationStatus = Database["public"]["Enums"]["conversation_status"];
type ConversationCategory = Database["public"]["Enums"]["conversation_category"];
type Channel = Database["public"]["Enums"]["channel_type"];

export default async function ConversationsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const organizationResult = await resolveOrganizationContext(supabase);
  if (!organizationResult.ok) redirect("/login");
  const clinicId = organizationResult.context.organization.id;
  const clinicName = organizationResult.context.organization.name;

  const [{ data: nonPhoneConversations, error: inboxError }, { data: callSessions }] =
    await Promise.all([
      supabase
        .from("v_conversations_inbox")
        .select("*")
        .eq("clinic_id", clinicId)
        .neq("channel", "phone")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(200),
      supabase
        .from("call_sessions")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("started_at", { ascending: false })
        .limit(200),
    ]);

  if (inboxError) {
    throw new Error(`No se pudo cargar la bandeja: ${inboxError.message}`);
  }

  const callConversationIds = (callSessions ?? []).map((call) => call.conversation_id);
  const { data: phoneConversations } =
    callConversationIds.length > 0
      ? await supabase
          .from("v_conversations_inbox")
          .select("*")
          .eq("clinic_id", clinicId)
          .in("id", callConversationIds)
      : { data: [] };
  const phoneConversationById = new Map((phoneConversations ?? []).map((row) => [row.id, row]));
  const inboxConversations = [
    ...(nonPhoneConversations ?? []),
    ...(callSessions ?? []).flatMap((call) => {
      const conversation = phoneConversationById.get(call.conversation_id);
      return conversation
        ? [
            {
              ...conversation,
              client_phone: conversation.client_phone ?? call.from_number,
              last_message_at: conversation.last_message_at ?? call.ended_at ?? call.started_at,
              started_at: call.started_at,
              call_count: 1,
              last_call_duration_seconds: call.duration_seconds,
              call_status: call.status,
              call_from_number: call.from_number,
              call_transcript_status: call.transcript_status,
            },
          ]
        : [];
    }),
  ].sort(
    (left, right) =>
      new Date(right.last_message_at ?? right.started_at ?? 0).getTime() -
      new Date(left.last_message_at ?? left.started_at ?? 0).getTime(),
  );

  const rows = inboxConversations.flatMap((row) => {
    if (!row.id || !row.status || !row.channel || !row.started_at) return [];
    return [
      {
        ...row,
        id: row.id,
        status: row.status as ConversationStatus,
        category: row.category as ConversationCategory | null,
        channel: row.channel as Channel,
        started_at: row.started_at,
      },
    ];
  });

  const clientIds = [...new Set(rows.flatMap((row) => (row.client_id ? [row.client_id] : [])))];
  const { data: inboxPets } =
    clientIds.length > 0
      ? await supabase
          .from("pets")
          .select("client_id, name")
          .eq("clinic_id", clinicId)
          .eq("active", true)
          .is("deleted_at", null)
          .in("client_id", clientIds)
          .order("name", { ascending: true })
      : { data: [] };
  const petNamesByClient = new Map<string, string[]>();
  for (const pet of inboxPets ?? []) {
    const names = petNamesByClient.get(pet.client_id) ?? [];
    names.push(pet.name);
    petNamesByClient.set(pet.client_id, names);
  }

  return (
    <div className="flex h-full">
      {/* List panel */}
      <ConversationsList
        conversations={rows.map((c) => ({
          id: c.id,
          client_name: c.client_name,
          client_phone: c.client_phone,
          pet_name: c.pet_name,
          pet_names: c.client_id ? (petNamesByClient.get(c.client_id) ?? []) : [],
          status: c.status,
          category: c.category,
          urgency_level: c.urgency_level,
          channel: c.channel,
          message_count: c.message_count ?? 0,
          call_count: c.call_count ?? 0,
          last_call_duration_seconds: c.last_call_duration_seconds,
          last_message_at: c.last_message_at,
          last_message_preview: c.last_message_preview,
          last_message_sender: c.last_message_sender,
          started_at: c.started_at,
          controlled_by: c.controlled_by,
          metadata: c.metadata,
          call_status:
            "call_status" in c && typeof c.call_status === "string" ? c.call_status : null,
          call_from_number:
            "call_from_number" in c && typeof c.call_from_number === "string"
              ? c.call_from_number
              : null,
          call_transcript_status:
            "call_transcript_status" in c && typeof c.call_transcript_status === "string"
              ? c.call_transcript_status
              : null,
        }))}
        clinicName={clinicName}
        clinicId={clinicId}
      />

      {/* Detail panel */}
      <div className="hidden flex-1 lg:block">{children}</div>

      {/* Mobile: detail-only view */}
      <div className="flex-1 lg:hidden">{children}</div>
    </div>
  );
}
