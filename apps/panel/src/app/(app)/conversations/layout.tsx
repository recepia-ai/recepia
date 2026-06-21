import { createClient } from "@/lib/supabase/server";
import { ConversationsList } from "./_components/conversations-list";
import type { Database } from "@recepia/db";

type ActiveConvRow = Database["public"]["Views"]["v_active_conversations"]["Row"];

export default async function ConversationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch conversations via the view (RLS scoped to user's clinic).
  const { data: conversations } = await supabase
    .from("v_active_conversations")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);

  // Fetch clinic name for the subtitle.
  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinics(name)")
    .eq("user_id", user!.id)
    .maybeSingle();

  const clinicRow = clinicUser as
    | { clinics: { name: string } | { name: string }[] | null }
    | null;
  const clinic = clinicRow
    ? Array.isArray(clinicRow.clinics)
      ? clinicRow.clinics[0] ?? null
      : clinicRow.clinics
    : null;
  const clinicName = clinic?.name ?? "tu clínica";

  const rows = (conversations ?? []) as ActiveConvRow[];

  return (
    <div className="flex h-full">
      {/* List panel */}
      <ConversationsList
        conversations={rows.map((c) => ({
          id: c.id!,
          client_name: c.client_name,
          client_phone: c.client_phone,
          pet_name: c.pet_name,
          status: c.status!,
          category: c.category,
          message_count: c.message_count ?? 0,
          last_message_at: c.last_message_at,
        }))}
        clinicName={clinicName}
      />

      {/* Detail panel */}
      <div className="hidden flex-1 lg:block">{children}</div>

      {/* Mobile: detail-only view */}
      <div className="flex-1 lg:hidden">{children}</div>
    </div>
  );
}
