"use client";

import { Database, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type GestorVetSettings,
  runGestorVetDiscovery,
  saveGestorVetIntegration,
} from "./gestorvet-actions";

const inputClass =
  "h-10 w-full rounded-lg border border-stone-200 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

export function GestorVetCard({ settings }: { settings: GestorVetSettings }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await saveGestorVetIntegration(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        "GestorVet conectado; la sincronización permanece pausada hasta completar mapeos",
      );
      router.refresh();
    });
  }

  function discover() {
    startTransition(async () => {
      const result = await runGestorVetDiscovery();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Inventario de GestorVet completado sin modificar datos");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
          <Database className="size-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-stone-900">GestorVet</h3>
            {settings.connected && (
              <Badge className="border-emerald-200 bg-emerald-50 text-xs text-emerald-700 hover:bg-emerald-50">
                Conectado
              </Badge>
            )}
            {settings.connected && !settings.syncEnabled && (
              <Badge variant="outline" className="text-xs text-amber-700">
                Sincronización pausada
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-stone-500">
            Mantiene GestorVet y Recepia en convivencia durante la transición del hospital.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input
          className={inputClass}
          name="noc"
          placeholder="NOC de la clínica"
          defaultValue={settings.noc}
          autoComplete="off"
          required
        />
        <input
          className={inputClass}
          name="api_key"
          type="password"
          placeholder={settings.connected ? "Nueva API key (sustituirá la actual)" : "API key"}
          autoComplete="new-password"
          required
        />
      </div>

      <p className="mt-3 text-xs leading-5 text-stone-500">
        Al guardar se realiza una comprobación de solo lectura y la credencial queda cifrada en
        Vault. Las escrituras no se activan hasta validar IDs, especies, veterinarios y motivos de
        consulta.
      </p>

      <Button className="mt-4" size="sm" disabled={busy}>
        {busy && <Loader2 className="size-3.5 animate-spin" />}
        {settings.connected ? "Verificar y actualizar" : "Conectar GestorVet"}
      </Button>

      {settings.connected && (
        <div className="mt-4 border-t border-stone-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-stone-700">Inventario de solo lectura</p>
              <p className="mt-0.5 text-xs text-stone-500">
                Guarda solo cantidades y nombres de campos, nunca datos personales.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={discover}>
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Search className="size-3.5" />
              )}
              Ejecutar inventario
            </Button>
          </div>

          {settings.discovery && (
            <div className="mt-3 rounded-lg bg-stone-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-stone-700">
                  {settings.discovery.totalRecords.toLocaleString("es-ES")} registros leídos
                </span>
                <span className="text-stone-500">
                  {new Date(settings.discovery.completedAt).toLocaleString("es-ES")}
                </span>
              </div>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {settings.discovery.resources.map((resource) => (
                  <div
                    className="flex items-center justify-between rounded-md bg-white px-2.5 py-1.5 text-xs"
                    key={resource.resource}
                  >
                    <span className="text-stone-600">{resource.resource}</span>
                    <span
                      className={
                        resource.status === "succeeded" ? "text-stone-900" : "text-red-600"
                      }
                    >
                      {resource.count?.toLocaleString("es-ES") ?? "Error"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
