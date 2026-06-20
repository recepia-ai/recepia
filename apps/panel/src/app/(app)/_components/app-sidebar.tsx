"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  MessageSquareText,
  Calendar,
  Users,
  Settings,
} from "lucide-react";

// -- Navigation definition ------------------------------------------------

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: Home, enabled: true },
  {
    href: "/conversations",
    label: "Conversaciones",
    icon: MessageSquareText,
    enabled: true,
  },
  {
    href: "/calendar",
    label: "Calendario",
    icon: Calendar,
    enabled: false,
  },
  {
    href: "/clients",
    label: "Clientes",
    icon: Users,
    enabled: false,
  },
  {
    href: "/settings",
    label: "Ajustes",
    icon: Settings,
    enabled: false,
  },
];

// -- Component -------------------------------------------------------------

type Props = {
  clinicName: string;
};

export function AppSidebar({ clinicName }: Props) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
        <div className="flex size-7 items-center justify-center rounded-md bg-slate-900 text-xs font-bold text-white">
          R
        </div>
        <span className="text-sm font-semibold text-slate-900">Recepia</span>
      </div>

      {/* Clinic name */}
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-xs font-medium text-slate-500">Clínica</p>
        <p className="truncate text-sm font-medium text-slate-900">
          {clinicName}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-disabled={!item.enabled}
              tabIndex={item.enabled ? undefined : -1}
              className={cn(
                "group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                item.enabled &&
                  isActive &&
                  "bg-slate-100 text-slate-900",
                item.enabled &&
                  !isActive &&
                  "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                !item.enabled &&
                  "cursor-not-allowed text-slate-400 select-none",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {!item.enabled && (
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                  pronto
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200 px-4 py-3">
        <p className="text-[11px] text-slate-400">
          Recepia · Piloto Dr. Patiño
        </p>
      </div>
    </aside>
  );
}
