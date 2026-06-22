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
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
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
  { href: "/calendar", label: "Calendario", icon: Calendar, enabled: true },
  { href: "/clients", label: "Clientes", icon: Users, enabled: true },
  { href: "/settings", label: "Ajustes", icon: Settings, enabled: true },
];

// -- Component -------------------------------------------------------------

type Props = {
  clinicName: string;
};

export function AppSidebar({ clinicName }: Props) {
  const pathname = usePathname();

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-stone-200 bg-white shadow-sidebar">
      {/* Brand — gradient monogram */}
      <div className="flex h-14 items-center px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-teal-700">
            <span className="text-sm font-bold text-white">R</span>
          </div>
          <span className="text-base font-semibold text-stone-900">
            Recepia
          </span>
        </div>
      </div>

      {/* Clinic name */}
      <div className="px-4 pb-2">
        <p className="truncate text-xs text-stone-500">{clinicName}</p>
      </div>

      {/* Separator */}
      <div className="mx-3 border-t border-stone-100" />

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
                  "bg-gradient-to-r from-emerald-500/10 to-teal-600/5 border-l-2 border-emerald-500 text-emerald-700 -ml-1 pl-[11px]",
                item.enabled &&
                  !isActive &&
                  "text-stone-600 hover:bg-stone-50 hover:text-stone-900",
                !item.enabled &&
                  "cursor-not-allowed text-stone-400 opacity-50 select-none",
              )}
            >
              <Icon className="size-4 shrink-0" strokeWidth={1.75} />
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
      <div className="border-t border-stone-200 px-4 py-3">
        <p className="flex items-center gap-1.5 text-[11px] text-stone-400">
          <span className="inline-block size-1.5 shrink-0 rounded-full bg-emerald-500" />
          Powered by Claude AI
        </p>
      </div>
    </aside>
  );
}
