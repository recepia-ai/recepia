import type { Database } from "@recepia/db";

type ConversationCategory = Database["public"]["Enums"]["conversation_category"];

const CATEGORY_CONFIG: Record<
  ConversationCategory,
  { label: string; ring: string; text: string }
> = {
  cita: {
    label: "Cita",
    ring: "ring-emerald-600/10",
    text: "text-emerald-700",
  },
  urgencia: {
    label: "Urgencia",
    ring: "ring-rose-600/10",
    text: "text-rose-700",
  },
  vacunacion: {
    label: "Vacunación",
    ring: "ring-sky-600/10",
    text: "text-sky-700",
  },
  peluqueria: {
    label: "Peluquería",
    ring: "ring-stone-400/10",
    text: "text-stone-600",
  },
  hospitalizacion: {
    label: "Hospitalización",
    ring: "ring-amber-600/10",
    text: "text-amber-700",
  },
  medicacion: {
    label: "Medicación",
    ring: "ring-sky-600/10",
    text: "text-sky-700",
  },
  receta: {
    label: "Receta",
    ring: "ring-stone-400/10",
    text: "text-stone-600",
  },
  informe: {
    label: "Informe",
    ring: "ring-stone-400/10",
    text: "text-stone-600",
  },
  administracion: {
    label: "Administración",
    ring: "ring-stone-400/10",
    text: "text-stone-600",
  },
  informacion_general: {
    label: "Información",
    ring: "ring-stone-400/10",
    text: "text-stone-600",
  },
} as const;

type Props = {
  category: ConversationCategory;
};

export function CategoryBadge({ category }: Props) {
  const config = CATEGORY_CONFIG[category];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${config.ring} ${config.text}`}
    >
      {config.label}
    </span>
  );
}
