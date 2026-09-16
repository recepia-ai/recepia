import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { HeaderRouteName } from "./header-route-name";

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
      <HeaderRouteName />

      {/* Right: user + divider + logout */}
      <div className="flex items-center gap-3">
        <span className="hidden max-w-64 truncate text-sm text-stone-500 lg:inline">
          {userEmail}
        </span>
        <span aria-hidden className="hidden h-4 w-px bg-stone-200 lg:block" />
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
