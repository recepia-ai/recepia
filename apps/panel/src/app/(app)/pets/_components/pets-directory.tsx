"use client";

import { ChevronRight, PawPrint, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { PetCreateDialog } from "./pet-dialogs";

type PetListItem = {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  microchip: string | null;
  client_id: string;
  client_name: string;
  client_phone: string;
  record_count: number;
};

type ClientOption = { id: string; name: string; phone: string };

const SPECIES: Record<string, { icon: string; label: string }> = {
  dog: { icon: "🐕", label: "Perro" },
  cat: { icon: "🐈", label: "Gato" },
  rabbit: { icon: "🐇", label: "Conejo" },
  ferret: { icon: "🦦", label: "Hurón" },
  rodent: { icon: "🐹", label: "Roedor" },
  bird: { icon: "🐦", label: "Ave" },
  reptile: { icon: "🦎", label: "Reptil" },
  other: { icon: "🐾", label: "Otra" },
};
const FALLBACK_SPECIES = { icon: "🐾", label: "Otra" };

export function PetsDirectory({
  pets,
  clients,
  clinicId,
}: {
  pets: PetListItem[];
  clients: ClientOption[];
  clinicId: string;
}) {
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const supabase = createClient();
    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 200);
    };
    const channel = supabase
      .channel(`pets-directory:${clinicId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pets", filter: `clinic_id=eq.${clinicId}` },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [clinicId, router]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es-ES");
    if (!normalized) return pets;
    return pets.filter((pet) =>
      [pet.name, pet.species, pet.breed, pet.microchip, pet.client_name, pet.client_phone]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase("es-ES").includes(normalized) ?? false),
    );
  }, [pets, query]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Mascotas</h1>
          <p className="mt-1 text-sm text-stone-500">
            Fichas, propietarios e historial clínico centralizado.
          </p>
        </div>
        <PetCreateDialog clients={clients} />
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por mascota, propietario, raza o microchip…"
          className="pl-9"
        />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-200 bg-white px-6 py-16 text-center">
          <PawPrint className="mx-auto size-8 text-stone-300" />
          <p className="mt-3 text-sm font-medium text-stone-700">
            {query ? "No hay resultados para esta búsqueda" : "Todavía no hay mascotas"}
          </p>
          <p className="mt-1 text-xs text-stone-400">
            {query
              ? "Prueba con otro nombre, propietario, raza o microchip."
              : "Crea una mascota y vincúlala a uno de los clientes existentes."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((pet) => {
            const species = SPECIES[pet.species] ?? FALLBACK_SPECIES;
            return (
              <Link
                key={pet.id}
                href={`/pets/${pet.id}`}
                className="group rounded-xl border border-stone-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hero"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xl">
                    {species.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="truncate text-base font-semibold text-stone-900">
                        {pet.name}
                      </h2>
                      <ChevronRight className="size-4 text-stone-300 transition group-hover:text-emerald-600" />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-stone-500">
                      {[species.label, pet.breed].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-3 truncate text-sm font-medium text-stone-700">
                      {pet.client_name}
                    </p>
                    <p className="truncate text-xs text-stone-400">{pet.client_phone}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-[11px] text-stone-500">
                  <span>{pet.microchip ? `Chip ${pet.microchip}` : "Sin microchip"}</span>
                  <span>
                    {pet.record_count} {pet.record_count === 1 ? "registro" : "registros"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
