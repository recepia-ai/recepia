import { NextResponse, type NextRequest } from "next/server";
import { replaceSharedVetCalendars } from "@/lib/google-calendar-provisioning";
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
  // 4. Extract email via two strategies:
  //    a) id_token JWT decode (works when openid+email scopes are granted).
  //    b) userinfo endpoint fallback (Bearer {access_token}).
  // -------------------------------------------------------------------
  let email: string | null = null;

  // Strategy A: id_token (JWT)
  if (tokenData.id_token) {
    try {
      const parts = tokenData.id_token.split(".");
      if (parts.length === 3 && parts[1]) {
        const payload = JSON.parse(
          Buffer.from(parts[1], "base64url").toString("utf8"),
        );
        email = payload.email ?? null;
      }
    } catch (err) {
      console.error("[google/callback] id_token decode failed:", err);
    }
  }

  // Strategy B: userinfo endpoint (fallback if id_token missing or decode failed)
  if (!email) {
    try {
      const userinfoRes = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        },
      );
      if (userinfoRes.ok) {
        const userinfo = await userinfoRes.json();
        email = userinfo.email ?? null;
      } else {
        console.error(
          "[google/callback] userinfo endpoint failed:",
          userinfoRes.status,
          await userinfoRes.text(),
        );
      }
    } catch (err) {
      console.error("[google/callback] userinfo network error:", err);
    }
  }

  if (!email) {
    console.error("[google/callback] Could not extract email — both id_token and userinfo failed");
    // Non-fatal: we can proceed without email, but log for debugging
  }

  // -------------------------------------------------------------------
  // 5. Store or update tokens in Supabase Vault
  // -------------------------------------------------------------------
  const supabaseAdmin = createAdminClient();
  const { data: existingIntegration } = await supabaseAdmin
    .from("clinic_integrations")
    .select("id, vault_secret_id")
    .eq("clinic_id", clinicId)
    .eq("provider", "google_calendar")
    .maybeSingle();

  const existing = existingIntegration as {
    id: string;
    vault_secret_id: string;
  } | null;

  let refreshToken = tokenData.refresh_token ?? null;
  if (!refreshToken && existing?.vault_secret_id) {
    const { data: oldSecret } = await supabaseAdmin.rpc("vault_read_secret", {
      p_id: existing.vault_secret_id,
    });
    try {
      refreshToken = JSON.parse((oldSecret as string | null) ?? "{}").refresh_token ?? null;
    } catch {
      refreshToken = null;
    }
  }

  const secretValue = JSON.stringify({
    access_token: tokenData.access_token,
    refresh_token: refreshToken,
  });

  let vaultSecretId: string | null = null;
  try {
    if (existing?.vault_secret_id) {
      const { error: vaultError } = await supabaseAdmin.rpc("vault_update_secret", {
        p_id: existing.vault_secret_id,
        p_secret: secretValue,
        p_name: `gcal_clinic_${clinicId}`,
        p_description: `Google Calendar tokens — clinic ${clinicId}`,
      });
      if (vaultError) throw vaultError;
      vaultSecretId = existing.vault_secret_id;
    } else {
      const { data, error: vaultError } = await supabaseAdmin.rpc("vault_create_secret", {
        p_secret: secretValue,
        p_name: `gcal_clinic_${clinicId}`,
        p_description: `Google Calendar tokens — clinic ${clinicId}`,
      });
      if (vaultError) throw vaultError;
      vaultSecretId = data as string;
    }
  } catch (err) {
    console.error("[google/callback] Vault write error:", err);
    return NextResponse.redirect(
      new URL("/settings/integrations?error=vault_write", request.url),
    );
  }

  // -------------------------------------------------------------------
  // 6. UPSERT clinic_integrations without deleting the existing Vault secret.
  // -------------------------------------------------------------------
  try {
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    const integrationValues = {
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
    };

    const integrationWrite = existing
      ? await (supabaseAdmin.from("clinic_integrations") as any)
          .update(integrationValues)
          .eq("id", existing.id)
      : await (supabaseAdmin.from("clinic_integrations") as any).insert(integrationValues);

    if (integrationWrite.error) {
      console.error("[google/callback] clinic_integrations write error:", integrationWrite.error);
      return NextResponse.redirect(
        new URL("/settings/integrations?error=db_insert", request.url),
      );
    }

    const provisioned = await replaceSharedVetCalendars(clinicId, tokenData.access_token);
    if (provisioned.failed > 0) {
      console.error("[google/callback] dedicated calendar provisioning incomplete", provisioned);
    }
    console.info("[google/callback] dedicated calendar provisioning complete", provisioned);
  } catch (err) {
    console.error("[google/callback] clinic_integrations error:", err);
    return NextResponse.redirect(
      new URL("/settings/integrations?error=db_error", request.url),
    );
  }

  // -------------------------------------------------------------------
  // 7. Success — redirect to integrations page
  // -------------------------------------------------------------------
  return NextResponse.redirect(
    new URL("/settings/integrations?success=connected", request.url),
  );
}
