import { createAdminClient } from "@/lib/supabase/admin";
import { AcceptInvitationForm } from "./accept-form";
import { MailCheck, XCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InvitationRow = {
  id: string;
  clinic_id: string;
  email: string;
  role: string;
  display_name: string | null;
  status: string;
  expires_at: string;
};

type ClinicRow = { name: string };

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function AcceptInvitationPage({ searchParams }: Props) {
  const { token } = await searchParams;
  let invitation: InvitationRow | null = null;
  let clinicName: string | null = null;
  let error: string | null = null;

  if (!token) {
    error = "Falta el token de invitación.";
  } else {
    const supabaseAdmin = createAdminClient();

    const { data: inv } = (await supabaseAdmin
      .from("clinic_invitations")
      .select("id, clinic_id, email, role, display_name, status, expires_at")
      .eq("token", token)
      .eq("status", "pending")
      .maybeSingle()) as { data: InvitationRow | null };

    if (!inv) {
      error = "Invitación no encontrada o ya utilizada.";
    } else if (new Date(inv.expires_at) < new Date()) {
      error = "Esta invitación ha expirado. Pide al administrador que te envíe una nueva.";
    } else {
      invitation = inv;

      // Fetch clinic name for display
      const { data: clinic } = (await supabaseAdmin
        .from("clinics")
        .select("name")
        .eq("id", inv.clinic_id)
        .maybeSingle()) as { data: ClinicRow | null };

      clinicName = clinic?.name ?? "la clínica";
    }
  }

  // Error state
  if (error || !invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-card text-center">
          <XCircle className="mx-auto size-8 text-destructive" strokeWidth={1.5} />
          <h1 className="mt-3 text-lg font-semibold text-stone-900">
            Invitación no válida
          </h1>
          <p className="mt-1 text-sm text-stone-500">{error}</p>
        </div>
      </div>
    );
  }

  // Success: show acceptance form
  const displayName = invitation.display_name ?? "";
  const roleLabel = ROLE_LABELS[invitation.role] ?? invitation.role;

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-card">
        <div className="mb-6 text-center">
          <MailCheck className="mx-auto size-8 text-emerald-500" strokeWidth={1.5} />
          <h1 className="mt-3 text-lg font-semibold text-stone-900">
            Te han invitado a {clinicName}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Como <span className="font-medium text-stone-700">{roleLabel}</span>{" "}
            — {invitation.email}
          </p>
        </div>

        <AcceptInvitationForm
          token={token!}
          defaultDisplayName={displayName}
        />
      </div>
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  recepcion: "Recepción",
  veterinario: "Veterinario",
};
