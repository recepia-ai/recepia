import { Bot, CircleAlert, Headphones, LockKeyhole } from "lucide-react";
import { conversationControlState } from "@/lib/conversation-inbox";
import { cn } from "@/lib/utils";

const CONFIG = {
  ai: {
    label: "IA activa",
    icon: Bot,
    className: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  },
  attention: {
    label: "Requiere atención",
    icon: CircleAlert,
    className: "bg-amber-50 text-amber-800 ring-amber-600/20",
  },
  human: {
    label: "Control humano",
    icon: Headphones,
    className: "bg-sky-50 text-sky-700 ring-sky-600/15",
  },
  closed: {
    label: "Cerrada",
    icon: LockKeyhole,
    className: "bg-stone-100 text-stone-600 ring-stone-500/15",
  },
} as const;

export function ControlBadge({ status, compact = false }: { status: string; compact?: boolean }) {
  const config = CONFIG[conversationControlState(status)];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium ring-1 ring-inset",
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        config.className,
      )}
    >
      <Icon className={compact ? "size-2.5" : "size-3"} strokeWidth={1.9} />
      {config.label}
    </span>
  );
}
