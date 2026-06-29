import { createClient } from "@/lib/supabase/server";
import { ClientsList } from "./_components/clients-list";

type PetCountRow = { client_id: string; id: string };
type ClientListRow = { id: string; name: string | null; phone: string; email: string | null };

export default async function ClientsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch clinic info
  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinic_id, clinics(name)")
    .eq("user_id", user!.id)
    .maybeSingle();

  const cu = clinicUser as {
    clinic_id: string;
    clinics: { name: string } | { name: string }[] | null;
  } | null;

  const clinic = cu
    ? Array.isArray(cu.clinics)
      ? cu.clinics[0] ?? null
      : cu.clinics
    : null;

  const clinicName = clinic?.name ?? "tu clínica";
  const clinicId = cu?.clinic_id;

  if (!clinicId) {
    return <ClientsList clients={[]} clinicName={clinicName} />;
  }

  // Fetch pet counts per client
  const petCountsRes = await supabase
    .from("pets")
    .select("client_id, id")
    .eq("clinic_id", clinicId)
    .eq("active", true);
  const petCounts = (petCountsRes.data ?? []) as PetCountRow[];

  const countsByClient = new Map<string, number>();
  for (const p of petCounts) {
    countsByClient.set(p.client_id, (countsByClient.get(p.client_id) ?? 0) + 1);
  }

  // Fetch clients (active only, ordered by name)
  const clientsRes = await supabase
    .from("clients")
    .select("id, name, phone, email")
    .eq("clinic_id", clinicId)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(50);
  const clients = (clientsRes.data ?? []) as ClientListRow[];

  const rows = clients.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    pet_count: countsByClient.get(c.id) ?? 0,
  }));

  return (
    <div className="flex h-full">
      {/* List panel */}
      <ClientsList clients={rows} clinicName={clinicName} />

      {/* Detail panel — desktop */}
      <div className="hidden flex-1 lg:block">{children}</div>

      {/* Detail panel — mobile */}
      <div className="flex-1 lg:hidden">{children}</div>
    </div>
  );
}
