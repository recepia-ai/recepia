import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

type Props = {
  userEmail: string;
};

export function AppHeader({ userEmail }: Props) {
  async function signOut() {
    "use server";

    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      {/* Left: page title could go here — per-page layouts handle that */}
      <div />

      {/* Right: user + logout */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">{userEmail}</span>
        <form action={signOut}>
          <Button variant="ghost" size="sm" type="submit">
            Cerrar sesión
          </Button>
        </form>
      </div>
    </header>
  );
}
