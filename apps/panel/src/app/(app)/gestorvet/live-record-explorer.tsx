"use client";

import { ArrowLeft, ArrowRight, Loader2, Search } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { GestorVetRecord } from "@/lib/gestorvet/client";
import { getGestorVetRecordDetails, searchGestorVetRecords } from "./gestorvet-actions";

function displayValue(key: string, value: unknown): string {
  if (key.toLowerCase().includes("foto")) return value ? "Disponible" : "—";
  if (value === null || value === undefined || value === "") return "—";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > 220 ? `${text.slice(0, 217)}…` : text;
}

function recordId(record: GestorVetRecord): string | null {
  for (const [key, value] of Object.entries(record)) {
    if (key.replace(/[^a-z0-9]/gi, "").toLowerCase() !== "id") continue;
    if (typeof value === "string" || typeof value === "number") return String(value);
  }
  return null;
}

function recordName(record: GestorVetRecord): string {
  for (const [key, value] of Object.entries(record)) {
    if (key.replace(/[^a-z0-9]/gi, "").toLowerCase() !== "nombre") continue;
    if (typeof value === "string" || typeof value === "number") return String(value);
  }
  return "Sin nombre";
}

export function LiveRecordExplorer({
  resource,
  initialRecords,
}: {
  resource: "clients" | "pets";
  initialRecords: GestorVetRecord[];
}) {
  const [records, setRecords] = useState(initialRecords);
  const [details, setDetails] = useState<GestorVetRecord[] | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [busy, startTransition] = useTransition();

  function search(nextPage = 0) {
    startTransition(async () => {
      const result = await searchGestorVetRecords({ resource, query, page: nextPage });
      if (result.error || !result.records) {
        toast.error(result.error ?? "No se pudo realizar la búsqueda");
        return;
      }
      setRecords(result.records);
      setPage(nextPage);
      setDetails(null);
    });
  }

  function openDetails(id: string) {
    startTransition(async () => {
      const result = await getGestorVetRecordDetails({ resource, id });
      if (result.error || !result.records) {
        toast.error(result.error ?? "No se pudo abrir el registro");
        return;
      }
      setDetails(result.records);
    });
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          search(0);
        }}
      >
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input
            className="h-10 w-full rounded-lg border border-stone-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              resource === "clients"
                ? "Buscar cliente por nombre o ID"
                : "Buscar mascota por nombre o ID"
            }
            value={query}
          />
        </div>
        <Button disabled={busy} type="submit" variant="outline">
          {busy && <Loader2 className="size-4 animate-spin" />} Buscar
        </Button>
      </form>

      {details ? (
        <div className="space-y-3">
          <button
            className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:underline"
            onClick={() => setDetails(null)}
            type="button"
          >
            <ArrowLeft className="size-4" /> Volver a resultados
          </button>
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
            <h2 className="text-sm font-semibold text-stone-900">
              {resource === "clients" ? "Detalle del cliente" : "Detalle de la mascota"}
            </h2>
            <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(details[0] ?? {}).map(([key, value]) => (
                <div className="min-w-0 border-b border-stone-100 pb-2" key={key}>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                    {key}
                  </p>
                  <p className="mt-0.5 break-words text-sm text-stone-700">
                    {displayValue(key, value)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : resource === "pets" && !query && records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <Search className="mx-auto size-8 text-stone-300" />
          <p className="mt-3 text-sm font-medium text-stone-700">Busca una mascota</p>
          <p className="mt-1 text-xs text-stone-500">
            Se requiere nombre o ID para evitar cargar todo el archivo de GestorVet.
          </p>
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-500">
          No se encontraron registros con esos criterios.
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-card">
            <div className="divide-y divide-stone-100">
              {records.map((record) => {
                const id = recordId(record);
                return (
                  <button
                    className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-stone-50 disabled:cursor-default"
                    disabled={!id || busy}
                    key={id ?? JSON.stringify(record)}
                    onClick={() => id && openDetails(id)}
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-stone-800">
                        {recordName(record)}
                      </span>
                      <span className="mt-0.5 block text-xs text-stone-400">
                        ID {id ?? "no disponible"}
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-stone-400" />
                  </button>
                );
              })}
            </div>
          </div>

          {resource === "clients" && (
            <div className="flex items-center justify-between">
              <Button
                disabled={busy || page === 0}
                onClick={() => search(page - 1)}
                size="sm"
                variant="outline"
              >
                Anterior
              </Button>
              <span className="text-xs text-stone-500">Página {page + 1}</span>
              <Button
                disabled={busy || records.length < 100}
                onClick={() => search(page + 1)}
                size="sm"
                variant="outline"
              >
                Siguiente
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
