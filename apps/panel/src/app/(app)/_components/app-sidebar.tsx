"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  MessageSquare,
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
  { href: "/", label: "Dashboard", icon: LayoutDashboard, enabled: true },
  {
    href: "/conversations",
    label: "Conversaciones",
    icon: MessageSquare,
    enabled: true,
  },
  { href: "/calendar", label: "Calendario", icon: Calendar, enabled: false },
  { href: "/clients", label: "Clientes", icon: Users, enabled: false },
  { href: "/settings", label: "Ajustes", icon: Settings, enabled: false },
];

// -- Component -------------------------------------------------------------

type Props = {
  clinicName: string;
};

export function AppSidebar({ clinicName }: Props) {
  const pathname = usePathname();

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-zinc-200 bg-white">
      {/* Brand */}
      <div className="flex h-14 items-center px-4">
        <div className="flex items-center gap-2">
          <span className="inline-block size-2 shrink-0 rounded-full bg-emerald-600" />
          <span className="text-base font-semibold text-zinc-900">
            Recepia
          </span>
        </div>
      </div>

      {/* Clinic name */}
      <div className="px-4 pb-2">
        <p className="truncate text-xs text-zinc-500">{clinicName}</p>
      </div>

      {/* Separator */}
      <div className="mx-3 border-t border-zinc-100" />

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          const link = (
            <Link
              key={item.href}
              href={item.enabled ? item.href : "#"}
              aria-disabled={!item.enabled}
              tabIndex={item.enabled ? undefined : -1}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                item.enabled &&
                  isActive &&
                  "border-l-2 border-emerald-600 bg-emerald-50 text-emerald-700 -ml-1 pl-[11px]",
                item.enabled &&
                  !isActive &&
                  "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
                !item.enabled &&
                  "cursor-not-allowed text-zinc-400 opacity-50 select-none",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
            </Link>
          );

          if (!item.enabled) {
            return (
              <Tooltip key={item.href} delayDuration={300}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  Próximamente
                </TooltipContent>
              </Tooltip>
            );
          }

          return link;
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-200 px-4 py-3">
        <p className="text-[11px] text-zinc-400">Recepia · Piloto</p>
      </div>
    </aside>
  );
}
