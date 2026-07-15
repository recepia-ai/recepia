"use client";

import { useState, useTransition } from "react";
import { Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PingResult } from "./_action";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PingClient() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<PingResult | null>(null);

  function handleClick() {
    startTransition(async () => {
      const { pingAnthropic } = await import("./_action");
      const r = await pingAnthropic();
      setResult(r);
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-stone-700">
          Envía un mensaje mínimo a{" "}
          <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">
            claude-sonnet-5
          </code>{" "}
          y muestra la respuesta cruda. Sirve para verificar conectividad
          end-to-end: SDK &rarr; Anthropic API &rarr; panel.
        </p>
      </div>

      <Button onClick={handleClick} disabled={isPending} variant="default">
        {isPending ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Enviando ping…
          </>
        ) : (
          <>
            <Zap className="mr-2 size-4" />
            Enviar ping a Sonnet
          </>
        )}
      </Button>

      {result && (
        <div className="rounded-xl border border-stone-200 bg-stone-50 overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-2">
            <span className="text-xs font-semibold text-stone-600">
              Resultado
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                result.success
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700",
              )}
            >
              {result.success ? "OK" : "ERROR"}
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
            Pulsa el botón para probar la conexión con Anthropic.
          </p>
        </div>
      )}
    </div>
  );
}
