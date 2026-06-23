import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar } from "./_components/app-sidebar";
import { AppHeader } from "./_components/app-header";

type ClinicUserRow = {
  role: string;
  clinic_id: string;
  clinics: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-suspenders: middleware already protects, but TS needs the guard.
  if (!user) {
    redirect("/login");
  }

  // Load user's clinic membership + clinic info in a single query.
  const result = await supabase
    .from("clinic_users")
    .select("role, clinic_id, clinics(name, slug)")
    .eq("user_id", user.id)
    .maybeSingle();

  const clinicUser = result.data as ClinicUserRow | null;

  // Normalise the nested join result (could be single object or array).
  const clinic = clinicUser
    ? Array.isArray(clinicUser.clinics)
      ? clinicUser.clinics[0] ?? null
      : clinicUser.clinics
    : null;

  // No clinic linked → friendly blocked screen (not an error).
  if (!clinicUser || !clinic) {
    return (
      <html lang="es">
        <body className="antialiased">
          <main className="flex min-h-screen items-center justify-center bg-stone-50 p-8">
            <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-8 text-center shadow-card">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-amber-100">
                <span className="text-2xl">⚠️</span>
              </div>
              <h1 className="text-lg font-semibold text-stone-900">
                Sin acceso a clínicas
              </h1>
              <p className="mt-2 text-sm text-stone-500">
                Tu usuario no está vinculado a ninguna clínica. Contacta con el
                administrador de Recepia para que te asigne una.
              </p>
            </div>
          </main>
        </body>
      </html>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen overflow-hidden bg-stone-50">
        {/* Sidebar — fixed left */}
        <AppSidebar clinicName={clinic.name} />

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader userEmail={user.email!} />

          {/* Page content */}
          <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
        </div>
      </div>
      <Toaster position="top-right" richColors />
    </TooltipProvider>
  );
}
