import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatClient } from "./chat-client";
import { loadRecentConversationsList } from "./_actions/chat-actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClinicUserRow = { clinic_id: string; role: string };

// ---------------------------------------------------------------------------
// Page (Server Component)
// ---------------------------------------------------------------------------

export default async function ChatPage() {
  const supabase = await createClient();

  // ---------- Admin guard ----------
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinic_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  const cu = clinicUser as ClinicUserRow | null;
  if (!cu) redirect("/settings");
  if (cu.role !== "admin") redirect("/settings");

  // Load initial conversations list
  const conversationsResult = await loadRecentConversationsList();
  const initialConversations = conversationsResult.success
    ? (conversationsResult.conversations ?? [])
    : [];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-stone-900">
            Chat con el Agente
          </h2>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            Admin only
          </span>
        </div>
        <p className="mt-0.5 text-xs text-stone-500">
          E3 fase 3 — loop conversacional completo: system prompt → lookup_client →
          tools → respuesta final. Incluye debug panel con tool calls.
        </p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white shadow-card overflow-hidden">
        <ChatClient initialConversations={initialConversations} />
      </div>
    </div>
  );
}
