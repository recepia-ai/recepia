"use client";

import { useState, useTransition } from "react";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DirectTestLog } from "./_action";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DirectTestClient() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<DirectTestLog | null>(null);

  function handleClick() {
    startTransition(async () => {
      const { runDirectTest } = await import("./_action");
      const r = await runDirectTest();
      setResult(r);
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-stone-700">
          Llama a <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">createAppointment</code>{" "}
          directamente con datos hardcodeados. El resultado crudo se muestra debajo.
        </p>
        <ul className="mt-2 list-inside list-disc text-xs text-stone-500 space-y-0.5">
          <li>Cliente: Marc TestDirect (+34600000200) — upsert por teléfono</li>
          <li>Mascota: Firulais (perro) — upsert por nombre</li>
          <li>Servicio: 8e683cf8-2ca2-4687-8c6f-c05b495eba18</li>
          <li>Veterinario: 00000000-0000-0000-0000-000000000011 (Samuel)</li>
          <li>Fecha: 2026-07-08 14:30 UTC</li>
        </ul>
      </div>

      <Button
        onClick={handleClick}
        disabled={isPending}
        variant="default"
      >
        {isPending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Ejecutando…
          </>
        ) : (
          <>
            <Play className="mr-2 size-4" />
            Ejecutar test directo
          </>
        )}
      </Button>

      {result && (
        <div className="rounded-xl border border-stone-200 bg-stone-50 overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-2">
            <span className="text-xs font-semibold text-stone-600">Resultado</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                result.error
                  ? "bg-red-100 text-red-700"
                  : result.appointment?.success
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700",
              )}
            >
              {result.error
                ? "ERROR"
                : result.appointment?.success
                  ? "OK"
                  : "PENDING"}
            </span>
          </div>
          <pre className="p-4 text-xs text-stone-700 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {!result && (
        <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-6 py-12 text-center">
          <p className="text-sm text-stone-400">
            Pulsa el botón para ejecutar el test.
          </p>
        </div>
      )}
    </div>
  );
}
