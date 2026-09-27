/**
 * Non-destructive release-candidate preflight.
 *
 * It reads configuration and exercises RLS with a short-lived magic-link
 * session generated server-side. HTTP probes deliberately use invalid or
 * unauthenticated requests, so they cannot create conversations or events.
 *
 * pnpm dlx tsx apps/panel/scripts/release-preflight.ts \
 *   --clinic-slug dr-patino --base-url https://preview.example.com
 */

import type { Database } from "@recepia/db";
import { createClient } from "@supabase/supabase-js";

type JsonObject = Record<string, unknown>;
type Check = { name: string; status: "PASS"; detail?: string | number };

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

function requireValue(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Falta ${name}`);
  return value;
}

function pass(checks: Check[], name: string, detail?: string | number) {
  checks.push({ name, status: "PASS", ...(detail === undefined ? {} : { detail }) });
}

async function countRows(
  admin: ReturnType<typeof createClient<Database>>,
  table: "vet_consultation_hours" | "vet_calendars",
  clinicId: string,
): Promise<number> {
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);
  if (error) throw error;
  return count ?? 0;
}

async function expectHttp(
  checks: Check[],
  baseUrl: string,
  path: string,
  init: RequestInit,
  expected: number[],
  name: string,
) {
  const bypass = process.env.VERCEL_PROTECTION_BYPASS;
  const headers = new Headers(init.headers);
  if (bypass) headers.set("x-vercel-protection-bypass", bypass);
  const response = await fetch(new URL(path, baseUrl), { ...init, headers, redirect: "manual" });
  if (!expected.includes(response.status)) {
    throw new Error(`${name}: HTTP ${response.status}; esperado ${expected.join("/")}`);
  }
  pass(checks, name, response.status);
}

async function main() {
  const checks: Check[] = [];
  const clinicSlug = requireValue(option("--clinic-slug"), "--clinic-slug");
  const baseUrl = option("--base-url")?.replace(/\/$/, "");
  const url = requireValue(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireValue(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
  const serviceRole = requireValue(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    "SUPABASE_SERVICE_ROLE_KEY",
  );
  const expectedProjectRef = option("--expected-project-ref");
  const projectRef = new URL(url).hostname.split(".")[0];
  if (expectedProjectRef && projectRef !== expectedProjectRef) {
    throw new Error("El Supabase conectado no coincide con --expected-project-ref");
  }
  pass(checks, "supabase_project", expectedProjectRef ? "EXPECTED" : "RESOLVED");

  const admin = createClient<Database>(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: clinic, error: clinicError } = await admin
    .from("clinics")
    .select("id, slug, status, timezone, clinic_config(config)")
    .eq("slug", clinicSlug)
    .single();
  if (clinicError || !clinic) throw clinicError ?? new Error("Clínica ausente");
  if (clinic.status !== "active") throw new Error("La clínica no está activa");
  if (clinic.timezone !== "Europe/Madrid") throw new Error("Timezone inesperado");
  pass(checks, "clinic_active");
  pass(checks, "clinic_timezone", clinic.timezone);

  const configRelation = Array.isArray(clinic.clinic_config)
    ? clinic.clinic_config[0]
    : clinic.clinic_config;
  if (!configRelation) throw new Error("clinic_config ausente");
  const config = object(configRelation.config);
  const operations = object(config.operations);
  const channels = object(operations.ai_channels);
  for (const channel of ["web", "whatsapp", "phone"] as const) {
    if (typeof channels[channel] !== "boolean") {
      throw new Error(`Kill switch ${channel} no es booleano`);
    }
  }
  pass(checks, "kill_switches_typed");
  const recordingEnabled = object(config.voice).recording_enabled;
  if (recordingEnabled === true) throw new Error("La grabación de voz está activada");
  pass(checks, "recording_off", recordingEnabled === false ? "EXPLICIT" : "SAFE_DEFAULT");

  const [serviceResult, schedules, calendars] = await Promise.all([
    admin
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinic.id)
      .eq("active", true),
    countRows(admin, "vet_consultation_hours", clinic.id),
    countRows(admin, "vet_calendars", clinic.id),
  ]);
  if (serviceResult.error) throw serviceResult.error;
  const services = serviceResult.count ?? 0;
  if (services < 1) throw new Error("No hay servicios activos");
  if (schedules < 1) throw new Error("No hay horarios veterinarios");
  pass(checks, "active_services", services);
  pass(checks, "vet_schedules", schedules);
  pass(checks, "vet_calendars", calendars);

  const { data: googleIntegration, error: googleError } = await admin
    .from("clinic_integrations")
    .select("id, token_expires_at")
    .eq("clinic_id", clinic.id)
    .eq("provider", "google_calendar")
    .maybeSingle();
  if (googleError) throw googleError;
  pass(checks, "google_status", googleIntegration ? "CONFIGURED" : "NOT_CONFIGURED");

  const { data: clinicChannels, error: channelsError } = await admin
    .from("clinic_channels")
    .select("channel_type, provider, status")
    .eq("clinic_id", clinic.id);
  if (channelsError) throw channelsError;
  for (const channelType of ["web", "whatsapp", "phone"] as const) {
    const rows = (clinicChannels ?? []).filter((row) => row.channel_type === channelType);
    pass(
      checks,
      `channel_${channelType}`,
      rows.length ? rows.map((row) => row.status).join(",") : "ABSENT",
    );
  }

  const { data: adminMembership, error: membershipError } = await admin
    .from("clinic_users")
    .select("id, email, user_id, role")
    .eq("clinic_id", clinic.id)
    .eq("role", "admin")
    .not("user_id", "is", null)
    .not("email", "is", null)
    .limit(1)
    .maybeSingle();
  if (membershipError || !adminMembership?.email) {
    throw membershipError ?? new Error("No hay un admin autenticable");
  }
  pass(checks, "admin_role_present");

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: adminMembership.email,
  });
  if (linkError || !link.properties.hashed_token) {
    throw linkError ?? new Error("No se pudo generar la sesión RLS");
  }
  const userClient = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: otpError } = await userClient.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (otpError) throw otpError;
  pass(checks, "login_session");

  const { data: visibleClinics, error: visibleError } = await userClient
    .from("clinics")
    .select("id, slug");
  if (visibleError) throw visibleError;
  if (visibleClinics?.length !== 1 || visibleClinics[0]?.id !== clinic.id) {
    throw new Error("RLS no limita al tenant esperado");
  }
  const { data: otherClinic, error: otherClinicError } = await admin
    .from("clinics")
    .select("id")
    .neq("id", clinic.id)
    .limit(1)
    .maybeSingle();
  if (otherClinicError) throw otherClinicError;
  if (otherClinic) {
    const { data: leakedClinic, error: leakError } = await userClient
      .from("clinics")
      .select("id")
      .eq("id", otherClinic.id);
    if (leakError) throw leakError;
    if (leakedClinic?.length) throw new Error("RLS expone otro tenant");
  }
  for (const table of ["conversations", "appointments", "clinic_integrations"] as const) {
    const { data, error } = await userClient.from(table).select("clinic_id");
    if (error) throw error;
    if ((data ?? []).some((row) => row.clinic_id !== clinic.id)) {
      throw new Error(`RLS expone otro tenant en ${table}`);
    }
  }
  pass(checks, "tenant_isolation");

  if (baseUrl) {
    await expectHttp(checks, baseUrl, "/login", { method: "GET" }, [200], "public_login");
    await expectHttp(
      checks,
      baseUrl,
      "/settings",
      { method: "GET" },
      [301, 302, 303, 307, 308],
      "protected_panel",
    );
    await expectHttp(
      checks,
      baseUrl,
      "/api/channels/web/message",
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
      [400],
      "web_invalid_payload",
    );
    for (const [name, path] of [
      ["whatsapp_evolution_auth", "/api/channels/whatsapp/evolution"],
      ["whatsapp_360dialog_auth", "/api/channels/whatsapp/360dialog"],
      ["whatsapp_meta_auth", "/api/channels/whatsapp/meta"],
      ["vapi_auth", "/api/channels/phone/vapi"],
    ] as const) {
      await expectHttp(
        checks,
        baseUrl,
        path,
        { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
        [401],
        name,
      );
    }
    await expectHttp(
      checks,
      baseUrl,
      "/api/test-agent",
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
      [301, 302, 303, 307, 308, 404],
      "legacy_test_api_disabled",
    );
  } else {
    pass(checks, "http_probes", "SKIPPED_NO_BASE_URL");
  }

  console.info(JSON.stringify({ result: "PASS", destructive_writes: 0, checks }, null, 2));
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      result: "FAIL",
      destructive_writes: 0,
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exit(1);
});
