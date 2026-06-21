import { MessageSquare } from "lucide-react";

export function EmptyDetail() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      <div className="flex size-16 items-center justify-center rounded-full bg-emerald-50">
        <MessageSquare
          className="size-7 text-emerald-400"
          strokeWidth={1.75}
        />
      </div>
      <h3 className="mt-5 text-base font-semibold text-stone-900">
        Selecciona una conversación
      </h3>
      <p className="mt-1.5 max-w-xs text-center text-sm text-stone-500">
        Elige una conversación de la lista para ver su detalle y los mensajes.
      </p>
    </div>
  );
}
