"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchNativeGestorVetClients } from "../client-actions";

type ClientRow = {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  pet_count: number | null;
  source: "recepia" | "gestorvet";
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

type Props = {
  clients: ClientRow[];
  clinicName: string;
};

export function ClientsList({ clients, clinicName }: Props) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [gestorVetClients, setGestorVetClients] = useState(
    clients.filter((client) => client.source === "gestorvet"),
  );
  const [busy, startTransition] = useTransition();

  const nativeClients = useMemo(
    () => clients.filter((client) => client.source === "recepia"),
    [clients],
  );
  const visibleClients = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es-ES");
    const local = normalized
      ? nativeClients.filter((client) =>
          [client.name, client.phone, client.email]
            .filter(Boolean)
            .some((value) => value!.toLocaleLowerCase("es-ES").includes(normalized)),
        )
      : nativeClients;
    return [...local, ...gestorVetClients];
  }, [gestorVetClients, nativeClients, query]);

  function searchClients() {
    startTransition(async () => {
      const result = await searchNativeGestorVetClients(query);
      if (result.error || !result.clients) {
        toast.error(result.error ?? "No se pudo buscar en GestorVet");
        return;
      }
      setGestorVetClients(result.clients);
    });
  }

  const showListOnMobile = !pathname.startsWith("/clients/") || pathname === "/clients";

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col border-r border-stone-200 bg-white lg:w-[380px] lg:shrink-0",
        !showListOnMobile && "hidden lg:flex",
      )}
    >
      {/* Header */}
      <div className="shrink-0 space-y-3 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-stone-900">Clientes</h2>
            <p className="text-xs text-stone-500">
              {nativeClients.length} RECEPIA · {gestorVetClients.length} GestorVet visibles en{" "}
              {clinicName}
            </p>
          </div>
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-400"
          >
            <Plus className="size-3.5" strokeWidth={1.75} />
            Nuevo
          </button>
        </div>

        <form
          className="relative"
          onSubmit={(event) => {
            event.preventDefault();
            searchClients();
          }}
        >
          <Search
            className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-stone-400"
            strokeWidth={1.75}
          />
          <Input
            placeholder="Buscar también en GestorVet..."
            className="h-8 pl-8 pr-16 text-xs"
            onChange={(event) => setQuery(event.target.value)}
            value={query}
          />
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-medium text-emerald-700 disabled:text-stone-400"
            disabled={busy}
            type="submit"
          >
            {busy ? "Buscando" : "Buscar"}
          </button>
        </form>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {visibleClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <p className="text-sm text-stone-500">No hay clientes</p>
            <p className="mt-1 text-xs text-stone-400">Los clientes registrados aparecerán aquí</p>
          </div>
        ) : (
          visibleClients.map((client) => {
            const href =
              client.source === "gestorvet"
                ? `/clients/gestorvet/${client.id}`
                : `/clients/${client.id}`;
            const isActive = pathname === href;
            const displayName = client.name ?? client.phone ?? "Sin nombre";

            return (
              <Link
                key={`${client.source}:${client.id}`}
                href={href}
                prefetch={client.source === "recepia"}
                className={cn(
                  "block border-b border-stone-100 px-4 py-3 transition-colors",
                  isActive
                    ? "border-l-2 border-emerald-500 bg-emerald-50/50 pl-[14px]"
                    : "border-l-2 border-transparent hover:bg-stone-50",
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-medium text-stone-700">
                    {initials(displayName)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-medium text-stone-900">
                        {displayName}
                      </span>
                      {client.source === "gestorvet" && (
                        <span className="shrink-0 rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-700">
                          GestorVet
                        </span>
                      )}
                      <span className="shrink-0 text-xs tabular-nums text-stone-400">
                        {client.pet_count !== null && client.pet_count > 0
                          ? `${client.pet_count} 🐾`
                          : null}
                      </span>
                    </div>
                    {client.phone && (
                      <p className="truncate text-xs text-stone-500">{client.phone}</p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
