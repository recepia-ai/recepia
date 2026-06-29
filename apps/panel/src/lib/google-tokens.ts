"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { GoogleTokenRefreshResponse } from "./google-calendar-types";

// ---------------------------------------------------------------------------
// Token management — refresh + Vault access
// ---------------------------------------------------------------------------

const REFRESH_MARGIN_MS = 5 * 60 * 1000; // 5 minutes before expiry → refresh

type TokenResult =
  | { access_token: string }
  | { error: "REAUTH_REQUIRED" | "UNEXPECTED" };

/**
 * Returns a valid Google access_token for the given clinic, refreshing it
 * automatically if needed. Uses SUPABASE_SERVICE_ROLE_KEY (Vault access).
 *
 * On reauth: returns `{ error: "REAUTH_REQUIRED" }` → UI should prompt admin
 * to reconnect Google Calendar.
 */
export async function getValidAccessToken(
  clinicId: string,
): Promise<TokenResult> {
  const supabaseAdmin = createAdminClient();

  // 1. Find the integration
  const { data: integration } = await supabaseAdmin
    .from("clinic_integrations")
    .select("id, vault_secret_id, token_expires_at")
    .eq("clinic_id", clinicId)
    .eq("provider", "google_calendar")
    .maybeSingle();

  const intRow = integration as {
    id: string;
    vault_secret_id: string;
    token_expires_at: string | null;
  } | null;

  if (!intRow) return { error: "UNEXPECTED" };

  // 2. If token is still fresh, read from Vault and return
  if (
    intRow.token_expires_at &&
    new Date(intRow.token_expires_at).getTime() > Date.now() + REFRESH_MARGIN_MS
  ) {
    const token = await readAccessToken(supabaseAdmin, intRow.vault_secret_id);
    if (token) return { access_token: token };
    // Fall through to refresh if read fails
  }

  // 3. Read current secret to get refresh_token
  const secretJson = await readSecretRaw(supabaseAdmin, intRow.vault_secret_id);
  if (!secretJson) return { error: "REAUTH_REQUIRED" };

  let refreshToken: string | null = null;
  try {
    const parsed = JSON.parse(secretJson);
    refreshToken = parsed.refresh_token ?? null;
  } catch {
    return { error: "REAUTH_REQUIRED" };
  }

  if (!refreshToken) return { error: "REAUTH_REQUIRED" };

  // 4. Refresh with Google
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) return { error: "UNEXPECTED" };

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[getValidAccessToken] refresh failed:", res.status, errText);
      return { error: "REAUTH_REQUIRED" };
    }

    const data = (await res.json()) as GoogleTokenRefreshResponse;

    // 5. Update Vault with new tokens (keep old refresh_token if Google
    //    didn't return a new one — they sometimes rotate them)
    const newSecret = JSON.stringify({
      access_token: data.access_token,
      refresh_token: refreshToken,
    });

    // vault_update_secret wrapped in public schema via vault_wrappers migration
    const vaultName = `gcal_clinic_${clinicId}`;
    const vaultDesc = `Google Calendar tokens — clinic ${clinicId}`;
    await supabaseAdmin.rpc("vault_update_secret", {
      p_id: intRow.vault_secret_id,
      p_secret: newSecret,
      p_name: vaultName,
      p_description: vaultDesc,
    });

    // 6. Update token_expires_at
    const newExpiresAt = new Date(
      Date.now() + data.expires_in * 1000,
    ).toISOString();

    await supabaseAdmin
      .from("clinic_integrations")
      .update({ token_expires_at: newExpiresAt })
      .eq("id", intRow.id);

    return { access_token: data.access_token };
  } catch (err) {
    console.error("[getValidAccessToken] network error:", err);
    return { error: "UNEXPECTED" };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function readAccessToken(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  vaultSecretId: string,
): Promise<string | null> {
  const raw = await readSecretRaw(supabaseAdmin, vaultSecretId);
  if (!raw) return null;
  try {
    return JSON.parse(raw).access_token ?? null;
  } catch {
    return null;
  }
}

async function readSecretRaw(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  vaultSecretId: string,
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc("vault_read_secret", {
      p_id: vaultSecretId,
    });
    if (error) {
      console.error("[readSecretRaw] vault_read_secret error:", error);
      return null;
    }
    return data as string;
  } catch (err) {
    console.error("[readSecretRaw]", err);
    return null;
  }
}
