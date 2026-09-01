import { createAdminClient } from "@/lib/supabase/admin";
import { ensureDedicatedVetCalendar } from "@/lib/google-calendar-provisioning";

// ---------------------------------------------------------------------------
// linkPendingInvitationForUser
// ---------------------------------------------------------------------------
// Auto-provisions a clinic membership from a pending invitation.
//
// The invite flow sends the user a Supabase email whose link authenticates
// them and drops them into the app. Instead of a manual accept step, whenever
// an authenticated user has no membership we look up a pending, non-expired
// invitation matching their email and create the membership on the spot.
// Idempotent and safe to call on every request that detects a
// membership-less user.
//
// Uses the admin (service_role) client because the caller has no membership
// yet, so RLS on clinic_invitations / clinic_users would hide everything.
//
// Returns true if a membership was created.
// ---------------------------------------------------------------------------

export async function linkPendingInvitationForUser(
  userId: string,
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) return false;

  const admin = createAdminClient();

  // Already a member? Nothing to do (defensive — callers usually check first).
  const { data: existing } = await admin
    .from("clinic_users")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  if (existing && existing.length > 0) return false;

  // Most recent pending, non-expired invitation for this email (case-insensitive).
  const { data: invitations } = (await admin
    .from("clinic_invitations")
    .select("id, clinic_id, role, display_name")
    .ilike("email", email)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)) as {
    data:
      | {
          id: string;
          clinic_id: string;
          role: string;
          display_name: string | null;
        }[]
      | null;
  };

  const invitation = invitations?.[0];
  if (!invitation) return false;

  // Create the membership. Only ONE row is created so the app's single-clinic
  // assumption (clinic_users queried with maybeSingle) keeps holding.
  const insertQuery = admin.from("clinic_users") as any;
  const { data: createdMembership, error: insertError } = await insertQuery
    .insert({
      clinic_id: invitation.clinic_id,
      user_id: userId,
      role: invitation.role,
      display_name: invitation.display_name,
      email,
      staff_type:
        invitation.role === "veterinario"
          ? "vet"
          : invitation.role === "recepcion"
            ? "reception"
            : "admin",
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[linkPendingInvitation] insert error:", insertError);
    return false;
  }

  // Mark the invitation as accepted so it stops showing as pending.
  const updateQuery = admin.from("clinic_invitations") as any;
  await updateQuery
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  if (invitation.role === "veterinario" && createdMembership?.id) {
    const calendar = await ensureDedicatedVetCalendar(
      invitation.clinic_id,
      createdMembership.id,
      invitation.display_name,
    );
    if (!calendar.success) {
      console.error("[linkPendingInvitation] calendar provisioning failed", calendar.error);
    }
  }

  return true;
}
