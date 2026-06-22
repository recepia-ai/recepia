import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  recepcion: "Recepción",
  veterinario: "Veterinario",
};

type CuRow = {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
};

function initials(fallback: string): string {
  return fallback.slice(0, 2).toUpperCase();
}

export default async function SettingsTeamPage() {
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

  if (!clinicId) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 px-6 py-12 text-center">
        <p className="text-sm text-stone-500">
          No se pudo cargar el equipo.
        </p>
      </div>
    );
  }

  // Fetch all members of the clinic
  const { data: members } = await supabase
    .from("clinic_users")
    .select("id, user_id, role, created_at")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: true });

  const rows = (members ?? []) as CuRow[];
  const currentUserId = user!.id;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-stone-900">
            Miembros del equipo
          </h2>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
            {rows.length}
          </span>
        </div>
        <Button variant="outline" size="sm" disabled>
          <Plus className="size-3.5" strokeWidth={1.75} />
          Invitar miembro
        </Button>
      </div>

      {/* Member list */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-stone-50 px-6 py-12 text-center">
          <Users className="mx-auto size-5 text-stone-300" strokeWidth={1.75} />
          <p className="mt-2 text-sm text-stone-500">
            No hay miembros en el equipo.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
          {rows.map((member) => {
            const isCurrentUser = member.user_id === currentUserId;

            return (
              <div
                key={member.id}
                className="flex items-center gap-4 px-5 py-4"
              >
                {/* Avatar */}
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-medium text-stone-600">
                  {initials(
                    isCurrentUser
                      ? user?.email ?? member.user_id.slice(0, 2)
                      : member.user_id.slice(0, 2),
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-900">
                    {isCurrentUser
                      ? user?.email ?? member.user_id.slice(0, 8) + "…"
                      : member.user_id.slice(0, 8) + "…"}
                  </p>
                  <p className="text-xs text-stone-500">
                    {ROLE_LABELS[member.role] ?? member.role}
                    {isCurrentUser && (
                      <span className="ml-1.5 text-stone-400">(tú)</span>
                    )}
                  </p>
                </div>

                {/* Status */}
                <div className="shrink-0 text-right">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                    <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                    Activo
                  </span>
                  <p className="mt-1 text-[11px] text-stone-400">
                    {new Date(member.created_at).toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
