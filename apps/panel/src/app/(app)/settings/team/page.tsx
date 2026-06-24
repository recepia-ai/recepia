import { createClient } from "@/lib/supabase/server";
import { TeamList, type TeamMember } from "./team-list";
import { InvitationsList, type PendingInvitation } from "./invitations-list";
import { InviteModal } from "./invite-modal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClinicUserRow = { clinic_id: string; role: string };

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SettingsTeamPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 px-6 py-12 text-center">
        <p className="text-sm text-stone-500">No autenticado.</p>
      </div>
    );

  // Get clinic context
  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinic_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  const cu = clinicUser as ClinicUserRow | null;

  if (!cu)
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 px-6 py-12 text-center">
        <p className="text-sm text-stone-500">
          No estás asignado a ninguna clínica.
        </p>
      </div>
    );

  const isAdmin = cu.role === "admin";

  // Parallel: fetch members + pending invitations
  const [membersResult, invitationsResult] = await Promise.all([
    supabase
      .from("clinic_users")
      .select("id, user_id, display_name, email, role, created_at")
      .eq("clinic_id", cu.clinic_id)
      .order("created_at", { ascending: true }),
    isAdmin
      ? supabase
          .from("clinic_invitations")
          .select("id, email, role, created_at, expires_at")
          .eq("clinic_id", cu.clinic_id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
      : Promise.resolve(null),
  ]);

  const members = (membersResult.data ?? []) as TeamMember[];
  const invitations = invitationsResult
    ? ((invitationsResult as { data: PendingInvitation[] | null }).data ?? [])
    : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-stone-900">
            Miembros del equipo
          </h2>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
            {members.length}
          </span>
        </div>
        {isAdmin && <InviteModal />}
      </div>

      {/* Pending invitations (admin only) */}
      {isAdmin && <InvitationsList invitations={invitations} />}

      {/* Members */}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-stone-900">Miembros</h3>
        <TeamList members={members} currentUserId={user.id} />
      </div>
    </div>
  );
}
