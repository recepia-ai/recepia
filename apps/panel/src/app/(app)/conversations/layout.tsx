import type { Database } from "@recepia/db";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConversationsList } from "./_components/conversations-list";

type ConversationStatus = Database["public"]["Enums"]["conversation_status"];
type ConversationCategory = Database["public"]["Enums"]["conversation_category"];
type Channel = Database["public"]["Enums"]["channel_type"];

export default async function ConversationsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch clinic name for the subtitle.
  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinic_id, clinics(name)")
    .eq("user_id", user.id)
    .maybeSingle();

  const clinicRow = clinicUser as {
    clinic_id: string;
    clinics: { name: string } | { name: string }[] | null;
  } | null;
  const clinic = clinicRow
    ? Array.isArray(clinicRow.clinics)
      ? (clinicRow.clinics[0] ?? null)
      : clinicRow.clinics
    : null;
  const clinicName = clinic?.name ?? "tu clínica";

  const { data: inboxConversations, error: inboxError } = await supabase
    .from("v_conversations_inbox")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(200);

  if (inboxError) {
    throw new Error(`No se pudo cargar la bandeja: ${inboxError.message}`);
  }

  const rows = (inboxConversations ?? []).flatMap((row) => {
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

  return (
    <div className="flex h-full">
      {/* List panel */}
      <ConversationsList
        conversations={rows.map((c) => ({
          id: c.id,
          client_name: c.client_name,
          client_phone: c.client_phone,
          pet_name: c.pet_name,
          status: c.status,
          category: c.category,
          urgency_level: c.urgency_level,
          channel: c.channel,
          message_count: c.message_count ?? 0,
          call_count: c.call_count ?? 0,
          last_call_duration_seconds: c.last_call_duration_seconds,
          last_message_at: c.last_message_at,
          last_message_preview: c.last_message_preview,
          started_at: c.started_at,
        }))}
        clinicName={clinicName}
        clinicId={clinicRow?.clinic_id ?? null}
      />

      {/* Detail panel */}
      <div className="hidden flex-1 lg:block">{children}</div>

      {/* Mobile: detail-only view */}
      <div className="flex-1 lg:hidden">{children}</div>
    </div>
  );
}
