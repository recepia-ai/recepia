"use client";

import { usePathname } from "next/navigation";

const ROUTE_NAMES: Array<[prefix: string, label: string]> = [
  ["/conversations", "Conversaciones"],
  ["/calendar", "Agenda"],
  ["/clients", "Clientes"],
  ["/pets", "Mascotas"],
  ["/settings", "Ajustes"],
  ["/gestorvet", "Integración clínica"],
];

export function HeaderRouteName() {
  const pathname = usePathname();
  const label = ROUTE_NAMES.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "Dashboard";

  return (
    <span className="truncate text-sm font-medium tracking-tight text-stone-700">{label}</span>
  );
}
