"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { key: "clinic", label: "Clínica", href: "/settings/clinic" },
  { key: "profile", label: "Mi perfil", href: "/settings/profile" },
  { key: "team", label: "Equipo", href: "/settings/team" },
  { key: "integrations", label: "Integraciones", href: "/settings/integrations" },
] as const;

export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <div className="flex items-center rounded-lg border border-stone-200 bg-stone-50 p-0.5">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? "bg-white text-stone-700 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
