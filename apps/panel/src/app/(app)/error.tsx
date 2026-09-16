"use client";

import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[420px] max-w-xl items-center justify-center">
      <div className="w-full rounded-xl border border-stone-200 bg-white px-8 py-12 text-center shadow-card">
        <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <AlertCircle className="size-5" aria-hidden />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-stone-900">
          No hemos podido cargar esta sección
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-500">
          Puede ser un problema temporal. Vuelve a intentarlo; tus cambios guardados no se han
          perdido.
        </p>
        <Button type="button" className="mt-5" onClick={reset}>
          <RotateCcw className="size-4" /> Volver a intentar
        </Button>
      </div>
    </div>
  );
}
