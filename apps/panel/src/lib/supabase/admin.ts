import { createClient } from "@supabase/supabase-js";
import type { Database } from "@recepia/db";

/**
 * Creates a Supabase client with the service_role key.
 * This client BYPASSES RLS — use ONLY for server-side operations
 * that require elevated privileges (invitation emails, token validation
 * for unauthenticated users, etc.).
 *
 * NEVER expose this client or its methods to the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
