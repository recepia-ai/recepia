"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, Play, Wrench } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ToolTestResult } from "./_action";

// ---------------------------------------------------------------------------
// Pre-filled inputs for each tool (real seed values)
// ---------------------------------------------------------------------------

const PRE_FILLED: Record<string, string> = {
  lookup_client: JSON.stringify(
    { phone: "+34600000200" },
    null,
    2,
  ),
  register_new_client: JSON.stringify(
    { name: "Cliente Test Tool", phone: "+34600000199" },
    null,
    2,
  ),
  lookup_pets_by_client: JSON.stringify(
    { client_id: "cc000000-0000-0000-0000-000000000001" },
    null,
    2,
  ),
  register_new_pet: JSON.stringify(
    {
      client_id: "cc000000-0000-0000-0000-000000000001",
      name: "Mascota Test",
      species: "dog",
    },
    null,
    2,
  ),
  check_availability: JSON.stringify(
    {
      service_id: "a79c8b51-4041-446b-bc55-78d30316b627",
      date_from: "2026-07-09T00:00:00Z",
      date_to: "2026-07-16T00:00:00Z",
    },
    null,
    2,
  ),
  create_appointment: JSON.stringify(
    {
      client_id: "cc000000-0000-0000-0000-000000000001",
      pet_id: "pp000000-0000-0000-0000-000000000001",
      vet_user_id: "00000000-0000-0000-0000-000000000011",
      service_id: "8e683cf8-2ca2-4687-8c6f-c05b495eba18",
      starts_at: "2026-07-11T10:00:00Z",
    },
    null,
    2,
  ),
  escalate_to_human: JSON.stringify(
    {
      reason: "client_request",
      urgency: "medium",
      summary: "El cliente ha solicitado hablar con un veterinario humano.",
    },
    null,
    2,
  ),
};

const TOOL_LABELS: Record<string, string> = {
  lookup_client: "lookup_client — buscar cliente por teléfono",
  register_new_client: "register_new_client — registrar cliente nuevo",
  lookup_pets_by_client: "lookup_pets_by_client — listar mascotas",
  register_new_pet: "register_new_pet — registrar mascota nueva",
  check_availability: "check_availability — consultar disponibilidad",
  create_appointment: "create_appointment — crear cita",
  escalate_to_human: "escalate_to_human — escalar a humano",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ToolsClient() {
  const [isPending, startTransition] = useTransition();
  const [toolName, setToolName] = useState<string>("");
  const [inputJson, setInputJson] = useState<string>("");
  const [result, setResult] = useState<ToolTestResult | null>(null);

  const isValidJson = useMemo(() => {
    if (!inputJson.trim()) return false;
    try {
      JSON.parse(inputJson);
      return true;
    } catch {
      return false;
    }
  }, [inputJson]);

  function handleToolChange(name: string) {
    setToolName(name);
    setInputJson(PRE_FILLED[name] ?? "");
    setResult(null);
  }

  function handleClick() {
    if (!toolName || !isValidJson) return;

    startTransition(async () => {
      const { testInvokeTool } = await import("./_action");
      const r = await testInvokeTool(toolName, inputJson);
      setResult(r);

      if (!r.success && !r.validation_error) {
        toast.error(r.error ?? "Error desconocido");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-stone-700">
          Selecciona una tool y pulsa ejecutar. El input se rellena
          automáticamente con datos del seed. El resultado se muestra crudo.
        </p>
      </div>

      {/* Tool selector */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-stone-600">
          Tool
        </label>
        <Select value={toolName} onValueChange={handleToolChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecciona una tool…" />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(TOOL_LABELS).map((key) => (
              <SelectItem key={key} value={key}>
                {TOOL_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Input textarea */}
      {toolName && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-stone-600">
            Input JSON
          </label>
          <textarea
            value={inputJson}
            onChange={(e) => setInputJson(e.target.value)}
            rows={8}
            spellCheck={false}
            className={cn(
              "w-full rounded-lg border bg-white px-3 py-2 font-mono text-xs",
              "focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500",
              isValidJson
                ? "border-stone-200 text-stone-700"
                : "border-rose-200 text-rose-700 bg-rose-50",
            )}
          />
          {!isValidJson && inputJson.trim() && (
            <p className="mt-1 text-[10px] text-rose-500">JSON inválido</p>
          )}
        </div>
      )}

      {/* Execute button */}
      <Button
        onClick={handleClick}
        disabled={isPending || !toolName || !isValidJson}
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
            Ejecutar tool
          </>
        )}
      </Button>

      {/* Result */}
      {result && (
        <div className="rounded-xl border border-stone-200 bg-stone-50 overflow-hidden">
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-2">
            <span className="text-xs font-semibold text-stone-600">
              {result.tool_name}
              {result.validation_error && (
                <span className="ml-2 text-amber-600 font-normal">
                  (validation error)
                </span>
              )}
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

      {!result && !toolName && (
        <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-6 py-12 text-center">
          <Wrench className="mx-auto size-6 text-stone-300" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-stone-400">
            Selecciona una tool para empezar.
          </p>
        </div>
      )}
    </div>
  );
}
