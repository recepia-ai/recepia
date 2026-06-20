import { MessageSquareDashed } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-stone-200 bg-white p-12 shadow-card">
      <div className="flex size-12 items-center justify-center rounded-full bg-emerald-50">
        <MessageSquareDashed
          className="size-5 text-emerald-600"
          strokeWidth={1.75}
        />
      </div>
      <h3 className="mt-4 text-base font-semibold text-stone-900">
        No hay conversaciones todavía
      </h3>
      <p className="mt-1.5 text-sm text-stone-500">
        Cuando lleguen mensajes de WhatsApp aparecerán aquí.
      </p>
    </div>
  );
}
