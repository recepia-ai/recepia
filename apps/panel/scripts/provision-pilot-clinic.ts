/**
 * Internal, idempotent pilot-clinic provisioning. No provider secret belongs in
 * the manifest. By default it only validates and prints the deterministic plan.
 * Use --apply explicitly against the intended environment.
 *
 * pnpm dlx tsx apps/panel/scripts/provision-pilot-clinic.ts --manifest path.json
 * pnpm dlx tsx apps/panel/scripts/provision-pilot-clinic.ts --manifest path.json --apply
 */
import { readFile } from "node:fs/promises";
import type { Database } from "@recepia/db";
import { createClient } from "@supabase/supabase-js";
import { serviceSlug } from "../src/lib/operations-config";
import {
  initialPilotClinicConfig,
  parsePilotProvisioningSpec,
  provisioningIdentityKeys,
} from "../src/lib/pilot-provisioning";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function authUser(
  admin: ReturnType<typeof createClient<Database>>,
  email: string,
  displayName: string,
) {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const existing = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (existing) return existing;
    if (data.users.length < 100) break;
    page += 1;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: displayName, provisioned_by: "recepia-pilot-cli" },
  });
  if (error) throw error;
  return data.user;
}

async function main() {
  const manifestPath = option("--manifest");
  if (!manifestPath) throw new Error("Falta --manifest <ruta.json>");
  const spec = parsePilotProvisioningSpec(JSON.parse(await readFile(manifestPath, "utf8")));
  const keys = provisioningIdentityKeys(spec);
  console.info(
    JSON.stringify({ mode: process.argv.includes("--apply") ? "apply" : "dry-run", keys }, null, 2),
  );
  if (!process.argv.includes("--apply")) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole)
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient<Database>(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: clinic, error: clinicError } = await admin
    .from("clinics")
    .upsert(
      {
        name: spec.clinic.name,
        slug: spec.clinic.slug,
        locale: spec.clinic.locale,
        timezone: spec.clinic.timezone,
        phone: spec.clinic.phone,
        address_street: spec.clinic.address?.street ?? null,
        address_city: spec.clinic.address?.city ?? null,
        address_postal_code: spec.clinic.address?.postal_code ?? null,
        address_country: spec.clinic.address?.country ?? "ES",
        status: "active",
        metadata: { provisioner: "pilot-v1" },
      },
      { onConflict: "slug" },
    )
    .select("id, slug")
    .single();
  if (clinicError) throw clinicError;

  const { error: configError } = await admin.from("clinic_config").upsert({
    clinic_id: clinic.id,
    config: initialPilotClinicConfig(spec),
  });
  if (configError) throw configError;

  const people = [
    { ...spec.admin, role: "admin" as const, specialty: undefined },
    ...spec.veterinarians.map((vet) => ({ ...vet, role: "veterinario" as const })),
  ];
  const memberships = new Map<string, string>();
  for (const person of people) {
    const user = await authUser(admin, person.email, person.display_name);
    const { data: membership, error } = await admin
      .from("clinic_users")
      .upsert(
        {
          clinic_id: clinic.id,
          user_id: user.id,
          email: person.email.toLowerCase(),
          display_name: person.display_name,
          role: person.role,
          staff_type: person.role === "veterinario" ? "vet" : "admin",
          specialty_primary: person.specialty ?? null,
        },
        { onConflict: "clinic_id,user_id" },
      )
      .select("id")
      .single();
    if (error) throw error;
    memberships.set(person.email.toLowerCase(), membership.id);
  }

  const serviceIds = new Map<string, string>();
  for (const [sortOrder, service] of spec.services.entries()) {
    const slug = serviceSlug(service.name);
    const { data, error } = await admin
      .from("services")
      .upsert(
        {
          clinic_id: clinic.id,
          slug,
          name: service.name,
          description: service.description ?? null,
          duration_minutes: service.duration_minutes,
          price_min_cents: service.price_min_cents,
          price_max_cents: service.price_max_cents,
          is_surgery: service.is_surgery,
          requires_fasting: service.requires_fasting,
          escalates_for_pricing: service.escalates_for_pricing,
          active: true,
          sort_order: sortOrder,
        },
        { onConflict: "clinic_id,slug" },
      )
      .select("id")
      .single();
    if (error) throw error;
    serviceIds.set(slug, data.id);
  }

  for (const vet of spec.veterinarians) {
    const vetUserId = memberships.get(vet.email.toLowerCase());
    if (!vetUserId) throw new Error(`No se resolvió ${vet.email}`);
    for (const hours of vet.hours) {
      const { error } = await admin.from("vet_consultation_hours").upsert(
        {
          clinic_id: clinic.id,
          vet_user_id: vetUserId,
          day_of_week: hours.day_of_week,
          start_time: hours.start_time,
          end_time: hours.end_time,
        },
        { onConflict: "vet_user_id,day_of_week,start_time" },
      );
      if (error) throw error;
    }
  }

  for (const service of spec.services) {
    const serviceId = serviceIds.get(serviceSlug(service.name));
    if (!serviceId) throw new Error(`No se resolvió ${service.name}`);
    for (const email of service.veterinarian_emails) {
      const vetUserId = memberships.get(email.toLowerCase());
      if (!vetUserId) throw new Error(`No se resolvió ${email}`);
      const { error } = await admin
        .from("service_vet_assignments")
        .upsert(
          { clinic_id: clinic.id, service_id: serviceId, vet_user_id: vetUserId },
          { onConflict: "service_id,vet_user_id" },
        );
      if (error) throw error;
    }
  }

  console.info(
    JSON.stringify({ clinic_id: clinic.id, slug: clinic.slug, channels: "OFF", recording: "OFF" }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
