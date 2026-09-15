import type { Database } from "@recepia/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveOrganizationContext } from "@/lib/organization-context";
import { createClient } from "@/lib/supabase/server";

export type SettingsContext = {
  supabase: SupabaseClient<Database>;
  clinicId: string;
  membershipId: string;
  role: "admin" | "recepcion" | "veterinario";
};

export async function getSettingsContext(): Promise<
  { ok: true; context: SettingsContext } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const result = await resolveOrganizationContext(supabase);
  if (!result.ok) return { ok: false, error: result.message };

  return {
    ok: true,
    context: {
      supabase,
      clinicId: result.context.organization.id,
      membershipId: result.context.membership.id,
      role: result.context.membership.role,
    },
  };
}

export async function getAdminSettingsContext(): Promise<
  { ok: true; context: SettingsContext } | { ok: false; error: string }
> {
  const result = await getSettingsContext();
  if (!result.ok) return result;
  if (result.context.role !== "admin") {
    return { ok: false, error: "Solo un administrador puede cambiar esta configuración." };
  }
  return result;
}
