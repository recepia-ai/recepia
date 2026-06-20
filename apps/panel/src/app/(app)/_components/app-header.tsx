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
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-6">
      {/* Left: page title (static for now, dynamic later) */}
      <span className="text-sm font-medium tracking-tight text-stone-700">
        Dashboard
      </span>

      {/* Right: user + divider + logout */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-stone-500">{userEmail}</span>
        <span aria-hidden className="h-4 w-px bg-stone-200" />
        <form action={signOut}>
          <Button
            variant="ghost"
            size="sm"
            type="submit"
            className="text-stone-500 hover:bg-rose-50 hover:text-rose-600"
          >
            Cerrar sesión
          </Button>
        </form>
      </div>
    </header>
  );
}
