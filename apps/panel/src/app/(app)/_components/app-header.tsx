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
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6">
      {/* Left: page title (static for now, dynamic later) */}
      <span className="text-sm font-medium text-zinc-700">Dashboard</span>

      {/* Right: user + logout */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-500">{userEmail}</span>
        <form action={signOut}>
          <Button variant="ghost" size="sm" type="submit">
            Cerrar sesión
          </Button>
        </form>
      </div>
    </header>
  );
}
