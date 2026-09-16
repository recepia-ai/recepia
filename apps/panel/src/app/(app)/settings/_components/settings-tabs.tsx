"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { key: "clinic", label: "Clínica", href: "/settings/clinic" },
  { key: "services", label: "Servicios", href: "/settings/services" },
  { key: "veterinarians", label: "Veterinarios", href: "/settings/veterinarians" },
  { key: "schedules", label: "Horarios", href: "/settings/schedules" },
  { key: "team", label: "Equipo", href: "/settings/team" },
  { key: "integrations", label: "Integraciones", href: "/settings/integrations" },
  { key: "profile", label: "Perfil", href: "/settings/profile" },
] as const;

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones de ajustes"
      className="flex items-center gap-0.5 overflow-x-auto rounded-lg border border-stone-200 bg-stone-50 p-1"
    >
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive ? "bg-white text-stone-700 shadow-sm" : "text-stone-500 hover:text-stone-700"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
