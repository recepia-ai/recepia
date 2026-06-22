"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";

type ClientRow = {
  id: string;
  full_name: string | null;
  phone: string;
  email: string | null;
  pet_count: number;
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

  const showListOnMobile =
    !pathname.startsWith("/clients/") || pathname === "/clients";

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
            <h2 className="text-base font-semibold tracking-tight text-stone-900">
              Clientes
            </h2>
            <p className="text-xs text-stone-500">
              {clients.length}{" "}
              {clients.length === 1 ? "cliente" : "clientes"} en {clinicName}
            </p>
          </div>
          <button
            disabled
            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-400"
          >
            <Plus className="size-3.5" strokeWidth={1.75} />
            Nuevo
          </button>
        </div>

        {/* Search bar (disabled, visual only) */}
        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-stone-400"
            strokeWidth={1.75}
          />
          <Input
            placeholder="Buscar cliente..."
            className="h-8 pl-8 text-xs"
            disabled
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <p className="text-sm text-stone-500">No hay clientes</p>
            <p className="mt-1 text-xs text-stone-400">
              Los clientes registrados aparecerán aquí
            </p>
          </div>
        ) : (
          clients.map((client) => {
            const href = `/clients/${client.id}`;
            const isActive = pathname === href;
            const displayName =
              client.full_name ?? client.phone ?? "Sin nombre";

            return (
              <Link
                key={client.id}
                href={href}
                prefetch={true}
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
                      <span className="truncate text-sm font-medium text-stone-900">
                        {displayName}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-stone-400">
                        {client.pet_count > 0
                          ? `${client.pet_count} 🐾`
                          : null}
                      </span>
                    </div>
                    {client.phone && (
                      <p className="truncate text-xs text-stone-500">
                        {client.phone}
                      </p>
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
