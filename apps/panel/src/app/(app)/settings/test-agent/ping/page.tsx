import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PingClient } from "./ping-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClinicUserRow = { clinic_id: string; role: string };

// ---------------------------------------------------------------------------
// Page (Server Component)
// ---------------------------------------------------------------------------

export default async function PingPage() {
  const supabase = await createClient();

  // ---------- Admin guard ----------
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinic_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  const cu = clinicUser as ClinicUserRow | null;
  if (!cu) redirect("/settings");
  if (cu.role !== "admin") redirect("/settings");

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-stone-900">
            Ping Anthropic
          </h2>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            Admin only
          </span>
        </div>
        <p className="mt-0.5 text-xs text-stone-500">
          E3 fase 1 — verifica que el panel puede llamar a la API de Anthropic.
        </p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
        <PingClient />
      </div>
    </div>
  );
}
