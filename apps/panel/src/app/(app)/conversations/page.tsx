import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConversationsTable } from "./_components/conversations-table";
import { EmptyState } from "./_components/empty-state";
import { Plus, Search } from "lucide-react";
import type { Database } from "@recepia/db";

type ActiveConvRow = Database["public"]["Views"]["v_active_conversations"]["Row"];

export default async function ConversationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch conversations via the view (RLS scoped to user's clinic)
  const { data: conversations } = await supabase
    .from("v_active_conversations")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);

  // Fetch clinic name for the subtitle
  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinics(name)")
    .eq("user_id", user!.id)
    .maybeSingle();

  const clinicRow = clinicUser as { clinics: { name: string } | { name: string }[] | null } | null;
  const clinic = clinicRow
    ? Array.isArray(clinicRow.clinics)
      ? clinicRow.clinics[0] ?? null
      : clinicRow.clinics
    : null;
  const clinicName = clinic?.name ?? "tu clínica";

  const rows = (conversations ?? []) as ActiveConvRow[];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Conversaciones
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Gestiona las conversaciones activas de {clinicName}.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled className="mt-1">
          <Plus className="size-4" strokeWidth={1.75} />
          Nueva conversación
        </Button>
      </div>

      {/* Filter bar (visual only) */}
      <div className="flex items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" strokeWidth={1.75} />
          <Input
            placeholder="Buscar conversaciones..."
            className="h-9 pl-9 text-sm"
            disabled
          />
        </div>
        <div className="flex items-center rounded-lg border border-stone-200 bg-white p-0.5">
          <button className="rounded-md bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
            Todas
          </button>
          <button className="rounded-md px-3 py-1 text-xs font-medium text-stone-500 hover:text-stone-700" disabled>
            Activas
          </button>
          <button className="rounded-md px-3 py-1 text-xs font-medium text-stone-500 hover:text-stone-700" disabled>
            Esperando
          </button>
        </div>
      </div>

      {/* Content */}
      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <ConversationsTable
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
        />
      )}
    </div>
  );
}
