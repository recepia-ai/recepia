/** Connected, read-only verification for a provisioned Preview clinic. */

import type { Database } from "@recepia/db";
import { createClient } from "@supabase/supabase-js";
import { buildSystemPrompt } from "../src/lib/agent/system-prompt";
import { loadClinicAgentContext } from "../src/lib/clinic-agent-config";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const slug = option("--slug");
  const adminEmail = option("--admin-email");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!slug || !adminEmail || !url || !anonKey || !serviceRole) {
    throw new Error("Faltan opciones o credenciales del entorno");
  }
  const admin = createClient<Database>(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: clinic, error: clinicError } = await admin
    .from("clinics")
    .select("id, slug")
    .eq("slug", slug)
    .single();
  if (clinicError || !clinic) throw clinicError ?? new Error("Clínica ausente");

  const tables = [
    "clinic_users",
    "services",
    "vet_consultation_hours",
    "service_vet_assignments",
    "conversations",
    "appointments",
    "clinic_integrations",
  ] as const;
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const { count, error } = await admin
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinic.id);
    if (error) throw error;
    counts[table] = count ?? 0;
  }
  const context = await loadClinicAgentContext(admin, clinic.id);
  const prompt = buildSystemPrompt(context);
  if (/Patiño|Patino|Samuel|Anicura/i.test(prompt)) {
    throw new Error("El prompt sintético contiene identidad del primer piloto");
  }
  if (context.recordingEnabled || Object.values(context.aiChannels).some(Boolean)) {
    throw new Error("La clínica nueva no está en estado seguro OFF");
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: adminEmail,
  });
  if (linkError || !link.properties.hashed_token) throw linkError ?? new Error("Token ausente");
  const userClient = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: otpError } = await userClient.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (otpError) throw otpError;

  const { data: visibleClinics, error: visibleError } = await userClient
    .from("clinics")
    .select("id, slug");
  if (visibleError) throw visibleError;
  if (visibleClinics?.length !== 1 || visibleClinics[0]?.id !== clinic.id) {
    throw new Error("RLS permitió una clínica distinta o no resolvió la propia");
  }
  for (const table of ["conversations", "appointments", "clinic_integrations"] as const) {
    const { data, error } = await userClient.from(table).select("clinic_id");
    if (error) throw error;
    if ((data ?? []).some((row) => row.clinic_id !== clinic.id)) {
      throw new Error(`RLS expuso datos ajenos en ${table}`);
    }
  }

  console.info(
    JSON.stringify({
      clinic_id: clinic.id,
      slug: clinic.slug,
      counts,
      prompt: "ISOLATED",
      rls: "ISOLATED",
      channels: "OFF",
      recording: "OFF",
      service_names: context.services.map((service) => service.name),
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
