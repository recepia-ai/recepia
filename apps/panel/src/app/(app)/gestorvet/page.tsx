import { Database, ExternalLink } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import type { GestorVetRecord } from "@/lib/gestorvet/client";
import { readGestorVetClient } from "@/lib/gestorvet/discovery";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { LiveRecordExplorer } from "./live-record-explorer";

export const maxDuration = 30;

type Tab = "overview" | "clients" | "pets" | "agenda";
type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function displayValue(key: string, value: unknown): string {
  if (key.toLowerCase().includes("foto")) return value ? "Disponible" : "—";
  if (value === null || value === undefined || value === "") return "—";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > 220 ? `${text.slice(0, 217)}…` : text;
}

function tabHref(tab: Tab): string {
  return `/gestorvet?tab=${tab}`;
}

function Overview({
  metadata,
  runs,
}: {
  metadata: Record<string, unknown>;
  runs: Array<{
    id: string;
    resource: string;
    status: string;
    records_read: number;
    started_at: string;
  }>;
}) {
  const discovery = objectValue(metadata.discovery);
  const resources = Array.isArray(discovery.resources) ? discovery.resources : [];
  const totalRecords = typeof discovery.totalRecords === "number" ? discovery.totalRecords : 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-card">
          <p className="text-xs text-stone-500">Registros inventariados</p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">
            {totalRecords.toLocaleString("es-ES")}
          </p>
        </div>
        {resources
          .filter((item) => {
            const resource = objectValue(item).resource;
            return resource === "clients" || resource === "pets" || resource === "appointments";
          })
          .map((item) => {
            const resource = objectValue(item);
            const labels: Record<string, string> = {
              clients: "Clientes",
              pets: "Mascotas",
              appointments: "Agenda",
            };
            const name = typeof resource.resource === "string" ? resource.resource : "resource";
            const count = typeof resource.count === "number" ? resource.count : 0;
            return (
              <div
                className="rounded-xl border border-stone-200 bg-white p-4 shadow-card"
                key={name}
              >
                <p className="text-xs text-stone-500">{labels[name] ?? name}</p>
                <p className="mt-1 text-2xl font-semibold text-stone-900">
                  {count.toLocaleString("es-ES")}
                </p>
              </div>
            );
          })}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-900">Convivencia segura</p>
        <p className="mt-1 text-xs leading-5 text-amber-800">
          Esta área consulta GestorVet en vivo. La sincronización de salida continúa pausada y los
          registros todavía no se presentan como migrados a RECEPIA.
        </p>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
        <h2 className="text-sm font-semibold text-stone-900">Últimas ejecuciones</h2>
        <div className="mt-3 divide-y divide-stone-100">
          {runs.length === 0 ? (
            <p className="py-4 text-sm text-stone-500">Todavía no hay ejecuciones registradas.</p>
          ) : (
            runs.map((run) => (
              <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={run.id}>
                <div>
                  <p className="text-sm font-medium text-stone-700">{run.resource}</p>
                  <p className="text-xs text-stone-400">
                    {new Date(run.started_at).toLocaleString("es-ES")} ·{" "}
                    {run.records_read.toLocaleString("es-ES")} leídos
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {run.status}
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default async function GestorVetPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const requestedTab = first(params.tab);
  const tab: Tab = ["clients", "pets", "agenda"].includes(requestedTab)
    ? (requestedTab as Tab)
    : "overview";

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: membership } = await supabase
    .from("clinic_users")
    .select("clinic_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (!membership) {
    return <div className="text-sm text-stone-500">Tu usuario no tiene una clínica asignada.</div>;
  }

  const db = createAdminClient();
  let context: Awaited<ReturnType<typeof readGestorVetClient>>;
  try {
    context = await readGestorVetClient(db, membership.clinic_id);
  } catch {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-base font-semibold text-amber-900">GestorVet no está conectado</h1>
        <p className="mt-1 text-sm text-amber-800">
          Un administrador debe completar la conexión desde Ajustes → Integraciones.
        </p>
      </div>
    );
  }

  const metadata = objectValue(context.integration.metadata);
  const { data: runRows } = await db
    .from("integration_sync_runs")
    .select("id, resource, status, records_read, started_at")
    .eq("clinic_id", membership.clinic_id)
    .eq("provider", "gestorvet")
    .order("started_at", { ascending: false })
    .limit(10);

  const list: GestorVetRecord[] =
    tab === "clients"
      ? await context.client.getClients({ page: 0 })
      : tab === "agenda"
        ? await context.client.getAppointments()
        : [];

  const tabs: Array<{ value: Tab; label: string }> = [
    { value: "overview", label: "Resumen" },
    { value: "clients", label: "Clientes" },
    { value: "pets", label: "Mascotas" },
    { value: "agenda", label: "Agenda" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
              <Database className="size-4.5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-stone-900">GestorVet en RECEPIA</h1>
              <p className="text-xs text-stone-500">Consulta operativa durante la convivencia</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
            Conectado
          </Badge>
          <Badge variant="outline" className="text-amber-700">
            Escrituras pausadas
          </Badge>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto rounded-lg border border-stone-200 bg-white p-1">
        {tabs.map((item) => (
          <Link
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              tab === item.value
                ? "bg-emerald-50 text-emerald-700"
                : "text-stone-500 hover:bg-stone-50 hover:text-stone-800",
            )}
            href={tabHref(item.value)}
            key={item.value}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {tab === "overview" && <Overview metadata={metadata} runs={runRows ?? []} />}

      {(tab === "clients" || tab === "pets") && (
        <LiveRecordExplorer resource={tab} initialRecords={list} />
      )}

      {tab === "agenda" && (
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-stone-900">Agenda de GestorVet</h2>
              <p className="mt-0.5 text-xs text-stone-500">
                El endpoint actual solo proporciona la fecha; faltan las referencias clínicas.
              </p>
            </div>
            <Badge variant="outline">{list.length} registros</Badge>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((record) => (
              <div
                className="rounded-lg border border-stone-100 bg-stone-50 p-3"
                key={JSON.stringify(record)}
              >
                {Object.entries(record).map(([key, value]) => (
                  <p className="text-sm text-stone-700" key={key}>
                    <span className="text-xs font-medium text-stone-400">{key}: </span>
                    {displayValue(key, value)}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Link
          className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800"
          href="/settings/integrations"
        >
          Configurar integración <ExternalLink className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
