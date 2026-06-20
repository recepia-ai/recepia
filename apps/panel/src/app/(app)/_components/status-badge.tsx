import type { Database } from "@recepia/db";

type ConversationStatus = Database["public"]["Enums"]["conversation_status"];

const STATUS_CONFIG: Record<
  ConversationStatus,
  { label: string; dot: string; ring: string; text: string }
> = {
  active: {
    label: "Activa",
    dot: "bg-emerald-500",
    ring: "ring-emerald-600/10",
    text: "text-emerald-700",
  },
  awaiting_human: {
    label: "Esperando",
    dot: "bg-amber-500",
    ring: "ring-amber-600/10",
    text: "text-amber-700",
  },
  human_handling: {
    label: "Con humano",
    dot: "bg-sky-500",
    ring: "ring-sky-600/10",
    text: "text-sky-700",
  },
  completed: {
    label: "Completada",
    dot: "bg-stone-400",
    ring: "ring-stone-400/10",
    text: "text-stone-600",
  },
  transferred: {
    label: "Transferida",
    dot: "bg-rose-500",
    ring: "ring-rose-600/10",
    text: "text-rose-700",
  },
  abandoned: {
    label: "Abandonada",
    dot: "bg-stone-400",
    ring: "ring-stone-400/10",
    text: "text-stone-500",
  },
} as const;

type Props = {
  status: ConversationStatus;
};

export function StatusBadge({ status }: Props) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${config.ring} ${config.text}`}
    >
      <span
        className={`inline-block size-1.5 shrink-0 rounded-full ${config.dot}`}
      />
      {config.label}
    </span>
  );
}
