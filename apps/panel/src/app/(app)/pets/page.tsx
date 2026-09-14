import { notFound } from "next/navigation";
import { resolveOrganizationContext } from "@/lib/organization-context";
import { createClient } from "@/lib/supabase/server";
import { PetsDirectory } from "./_components/pets-directory";

type PetRow = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  microchip: string | null;
  client_id: string;
  clients: { name: string; phone: string } | { name: string; phone: string }[] | null;
};

export default async function PetsPage() {
  const supabase = await createClient();
  const organizationResult = await resolveOrganizationContext(supabase);
  if (!organizationResult.ok) notFound();
  const clinicId = organizationResult.context.organization.id;

  const [petsResult, clientsResult, recordsResult] = await Promise.all([
    supabase
      .from("pets")
      .select("id, name, species, breed, microchip, client_id, clients(name, phone)")
      .eq("clinic_id", clinicId)
      .eq("active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("clients")
      .select("id, name, phone")
      .eq("clinic_id", clinicId)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .limit(500),
    supabase
      .from("pet_records")
      .select("id, pet_id")
      .eq("clinic_id", clinicId)
      .is("deleted_at", null),
  ]);

  const recordCount = new Map<string, number>();
  for (const record of recordsResult.data ?? []) {
    recordCount.set(record.pet_id, (recordCount.get(record.pet_id) ?? 0) + 1);
  }

  const pets = ((petsResult.data ?? []) as PetRow[]).map((pet) => {
    const owner = pet.clients
      ? Array.isArray(pet.clients)
        ? (pet.clients[0] ?? null)
        : pet.clients
      : null;
    return {
      id: pet.id,
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      microchip: pet.microchip,
      client_id: pet.client_id,
      client_name: owner?.name ?? "Cliente sin nombre",
      client_phone: owner?.phone ?? "Sin teléfono",
      record_count: recordCount.get(pet.id) ?? 0,
    };
  });

  return (
    <PetsDirectory
      pets={pets}
      clinicId={clinicId}
      clients={(clientsResult.data ?? []).map((client) => ({
        id: client.id,
        name: client.name,
        phone: client.phone,
      }))}
    />
  );
}
