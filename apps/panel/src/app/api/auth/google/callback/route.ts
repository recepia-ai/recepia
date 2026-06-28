import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyState } from "@/lib/oauth-state";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET /api/auth/google/callback
// ---------------------------------------------------------------------------
// OAuth callback endpoint that Google redirects to after the user
// authorizes (or denies) the application.
//
// Flow:
//   1. Read code, state, error from query params.
//   2. Handle denial (user clicked "Cancel" in Google consent screen).
//   3. Verify HMAC state to prevent CSRF.
//   4. Exchange authorization code for tokens.
//   5. Decode id_token (JWT) to get the Google account email.
//   6. Store tokens in Supabase Vault → get vault_secret_id.
//   7. UPSERT clinic_integrations row.
//   8. Redirect to /settings/integrations with success/error.
// ---------------------------------------------------------------------------

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // -------------------------------------------------------------------
  // 1. Handle OAuth errors (user denied, etc.)
  // -------------------------------------------------------------------
  const error = searchParams.get("error");
  if (error) {
    console.error("[google/callback] Google returned error:", error);
    // TODO: log to observability system
    return NextResponse.redirect(
      new URL("/settings/integrations?error=oauth_denied", request.url),
    );
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    console.error("[google/callback] Missing code or state");
    return NextResponse.redirect(
      new URL("/settings/integrations?error=missing_params", request.url),
    );
  }

  // -------------------------------------------------------------------
  // 2. Verify state (CSRF protection)
  // -------------------------------------------------------------------
  const clinicId = verifyState(state);
  if (!clinicId) {
    console.error("[google/callback] State verification failed");
    return NextResponse.redirect(
      new URL("/settings/integrations?error=invalid_state", request.url),
    );
  }

  // -------------------------------------------------------------------
  // 3. Exchange authorization code for tokens
  // -------------------------------------------------------------------
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error("[google/callback] Missing Google OAuth env vars");
    return NextResponse.redirect(
      new URL("/settings/integrations?error=config", request.url),
    );
  }

  let tokenData: GoogleTokenResponse;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[google/callback] Token exchange failed:", tokenRes.status, errText);
      return NextResponse.redirect(
        new URL("/settings/integrations?error=token_exchange", request.url),
      );
    }

    tokenData = (await tokenRes.json()) as GoogleTokenResponse;
  } catch (err) {
    console.error("[google/callback] Token exchange network error:", err);
    return NextResponse.redirect(
      new URL("/settings/integrations?error=token_network", request.url),
    );
  }

  // -------------------------------------------------------------------
  // 4. Extract email from id_token (decoded JWT — no verify needed,
  //    we just got it directly from Google's token endpoint via HTTPS)
  // -------------------------------------------------------------------
  let email: string | null = null;
  try {
    const [, payloadB64] = tokenData.id_token.split(".");
    if (payloadB64) {
      const payload = JSON.parse(
        Buffer.from(payloadB64, "base64url").toString("utf8"),
      );
      email = payload.email ?? null;
    }
  } catch (err) {
    console.error("[google/callback] id_token decode failed:", err);
    // Non-fatal: we can proceed without email
  }

  // -------------------------------------------------------------------
  // 5. Store tokens in Supabase Vault
  // -------------------------------------------------------------------
  const supabaseAdmin = createAdminClient();
  const secretValue = JSON.stringify({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token ?? null,
  });

  let vaultSecretId: string | null = null;
  try {
    const { data, error: vaultError } = await (supabaseAdmin.rpc as any)(
      "create_secret",
      {
        secret: secretValue,
        name: `gcal_clinic_${clinicId}`,
        description: `Google Calendar tokens — clinic ${clinicId}`,
      },
    );

    if (vaultError) {
      console.error("[google/callback] Vault create_secret error:", vaultError);
      return NextResponse.redirect(
        new URL("/settings/integrations?error=vault_write", request.url),
      );
    }

    vaultSecretId = data as unknown as string;
  } catch (err) {
    console.error("[google/callback] Vault create_secret exception:", err);
    return NextResponse.redirect(
      new URL("/settings/integrations?error=vault_write", request.url),
    );
  }

  // -------------------------------------------------------------------
  // 6. UPSERT clinic_integrations
  //    - Delete any existing row for this clinic+provider (cascade
  //      doesn't reach Vault, so we'd need to delete the old Vault
  //      secret separately; but simpler: just overwrite)
  // -------------------------------------------------------------------
  try {
    // First, try to find and delete the old secret if it exists
    const { data: existing } = await supabaseAdmin
      .from("clinic_integrations")
      .select("id, vault_secret_id")
      .eq("clinic_id", clinicId)
      .eq("provider", "google_calendar")
      .maybeSingle();

    if (existing) {
      // Delete old vault secret (best effort)
      try {
        await (supabaseAdmin.rpc as any)("delete_secret", {
          id: (existing as any).vault_secret_id,
        });
      } catch {
        // Orphaned secret — not fatal
      }

      // Delete old integration row
      await supabaseAdmin
        .from("clinic_integrations")
        .delete()
        .eq("id", (existing as any).id);
    }

    // Insert new integration row
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    const { error: insertError } = await supabaseAdmin
      .from("clinic_integrations")
      .insert({
        clinic_id: clinicId,
        provider: "google_calendar",
        vault_secret_id: vaultSecretId,
        token_expires_at: expiresAt,
        scope: tokenData.scope,
        external_account_email: email,
        metadata: {
          connected_at: new Date().toISOString(),
          client_id_prefix: clientId.slice(0, 12),
        },
      } as any);

    if (insertError) {
      console.error("[google/callback] clinic_integrations insert error:", insertError);
      return NextResponse.redirect(
        new URL("/settings/integrations?error=db_insert", request.url),
      );
    }
  } catch (err) {
    console.error("[google/callback] clinic_integrations error:", err);
    return NextResponse.redirect(
      new URL("/settings/integrations?error=db_error", request.url),
    );
  }

  // -------------------------------------------------------------------
  // 7. Success — redirect to integrations page
  // -------------------------------------------------------------------
  // TODO(E5.X): after establishing vet_calendars, redirect to a
  // calendar-picker flow instead of a generic success message.
  return NextResponse.redirect(
    new URL("/settings/integrations?success=connected", request.url),
  );
}
