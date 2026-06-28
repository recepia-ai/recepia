"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { generateState } from "@/lib/oauth-state";
import type {
  IntegrationStatus,
  IntegrationActionState,
  IntegrationRow,
} from "./integration-schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ClinicUserRow = { clinic_id: string; role: string };

async function getAdminClinic(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" as const };

  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinic_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  const cu = clinicUser as ClinicUserRow | null;
  if (!cu) return { error: "Sin clínica asignada" as const };
  if (cu.role !== "admin") return { error: "Solo el administrador puede gestionar integraciones" as const };

  return { clinicId: cu.clinic_id, userId: user.id };
}

function googleOAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// initiateGoogleOAuth — admin-only, returns the Google OAuth URL to redirect
// ---------------------------------------------------------------------------

export async function initiateGoogleOAuth(): Promise<IntegrationActionState> {
  const supabase = await createClient();

  const admin = await getAdminClinic(supabase);
  if ("error" in admin) return { error: admin.error };

  try {
    const state = generateState(admin.clinicId);
    const url = googleOAuthUrl(state);
    return { success: true, redirectUrl: url };
  } catch (err) {
    console.error("[initiateGoogleOAuth]", err);
    return { error: "Error al iniciar la conexión con Google. Revisa la configuración." };
  }
}

// ---------------------------------------------------------------------------
// disconnectGoogleCalendar — admin-only, removes the integration completely
// ---------------------------------------------------------------------------

export async function disconnectGoogleCalendar(): Promise<IntegrationActionState> {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const admin = await getAdminClinic(supabase);
  if ("error" in admin) return { error: admin.error };

  // 1. Find the existing integration
  const { data: integration } = await supabase
    .from("clinic_integrations")
    .select("id, vault_secret_id")
    .eq("clinic_id", admin.clinicId)
    .eq("provider", "google_calendar")
    .maybeSingle();

  const intRow = integration as { id: string; vault_secret_id: string } | null;
  if (!intRow) {
    return { error: "No hay integración de Google Calendar que desconectar" };
  }

  // 2. Delete vault secret (via admin client — wrapper in public schema)
  try {
    const { error: vaultErr } = await supabaseAdmin.rpc(
      "vault_delete_secret",
      { p_id: intRow.vault_secret_id },
    );
    if (vaultErr) {
      console.error("[disconnectGoogleCalendar] vault delete error:", vaultErr);
    }
  } catch (err) {
    console.error("[disconnectGoogleCalendar] vault delete exception:", err);
    // Continue with cleanup even if vault delete fails — the secret is orphaned
    // but the integration row is what matters for the UI.
  }

  // 3. Delete vet_calendars linked to this clinic
  const { error: vcError } = await supabase
    .from("vet_calendars")
    .delete()
    .eq("clinic_id", admin.clinicId);

  if (vcError) {
    console.error("[disconnectGoogleCalendar] vet_calendars delete error:", vcError);
  }

  // 4. Delete the integration row
  const query = supabase.from("clinic_integrations") as any;
  const { error: deleteError } = await query
    .delete()
    .eq("id", intRow.id)
    .eq("clinic_id", admin.clinicId);

  if (deleteError) {
    console.error("[disconnectGoogleCalendar]", deleteError);
    return { error: "Error al desconectar. Intenta de nuevo." };
  }

  revalidatePath("/settings/integrations");
  return { success: true };
}

// ---------------------------------------------------------------------------
// getIntegrationStatus — read-only, returns connected/disconnected state
// ---------------------------------------------------------------------------

export async function getIntegrationStatus(): Promise<IntegrationStatus> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { connected: false };

  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinic_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const cu = clinicUser as { clinic_id: string } | null;
  if (!cu) return { connected: false };

  const { data: integration } = await supabase
    .from("clinic_integrations")
    .select("id, external_account_email, metadata, created_at")
    .eq("clinic_id", cu.clinic_id)
    .eq("provider", "google_calendar")
    .maybeSingle();

  const intRow = integration as IntegrationRow | null;
  if (!intRow) return { connected: false };

  return {
    connected: true,
    email: intRow.external_account_email ?? undefined,
    connectedAt: (intRow.metadata as any)?.connected_at ?? intRow.created_at,
  };
}
