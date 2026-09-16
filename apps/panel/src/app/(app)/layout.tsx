import { redirect } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { resolveOrganizationContext } from "@/lib/organization-context";
import { createClient } from "@/lib/supabase/server";
import { linkPendingInvitationForUser } from "@/lib/team/link-pending-invitation";
import { AppHeader } from "./_components/app-header";
import { AppSidebar } from "./_components/app-sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-suspenders: middleware already protects, but TS needs the guard.
  if (!user) {
    redirect("/login");
  }

  let organizationResult = await resolveOrganizationContext(supabase);

  // An invited user arrives here via the invite email with a session but no
  // membership row yet. Provision it from their pending invitation and re-read,
  // so they get access instead of the "Sin acceso a clínicas" screen.
  if (!organizationResult.ok && organizationResult.code === "NO_MEMBERSHIP") {
    const linked = await linkPendingInvitationForUser(user.id, user.email);
    if (linked) {
      organizationResult = await resolveOrganizationContext(supabase);
    }
  }

  if (!organizationResult.ok) {
    return (
      <html lang="es">
        <body className="antialiased">
          <main className="flex min-h-screen items-center justify-center bg-stone-50 p-8">
            <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-8 text-center shadow-card">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-amber-100">
                <span className="text-2xl">⚠️</span>
              </div>
              <h1 className="text-lg font-semibold text-stone-900">Acceso no disponible</h1>
              <p className="mt-2 text-sm text-stone-500">
                {organizationResult.message}. Contacta con el administrador de Recepia para revisar
                tu acceso.
              </p>
            </div>
          </main>
        </body>
      </html>
    );
  }

  const { actor, organization } = organizationResult.context;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen overflow-hidden bg-stone-50">
        {/* Sidebar — fixed left */}
        <AppSidebar clinicName={organization.name} />

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader userEmail={actor.email ?? "Usuario"} />

          {/* Page content */}
          <main className="flex-1 overflow-y-auto px-4 py-5 lg:px-6 xl:px-8 xl:py-6">
            {children}
          </main>
        </div>
      </div>
      <Toaster position="top-right" richColors />
    </TooltipProvider>
  );
}
