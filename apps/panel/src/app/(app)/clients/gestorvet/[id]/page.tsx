import { ArrowLeft, Database, PawPrint } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import type { GestorVetRecord } from "@/lib/gestorvet/client";
import { readGestorVetClient } from "@/lib/gestorvet/discovery";
import { gestorVetValue } from "@/lib/gestorvet/native-adapters";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

function field(record: GestorVetRecord, ...keys: string[]): string {
  return gestorVetValue(record, ...keys) ?? "—";
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 break-words text-sm text-stone-700">{value}</p>
    </div>
  );
}

export default async function GestorVetClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: membership } = await supabase
    .from("clinic_users")
    .select("clinic_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!membership) notFound();

  let clientRecord: GestorVetRecord | undefined;
  let pets: GestorVetRecord[] = [];
  try {
    const { client } = await readGestorVetClient(createAdminClient(), membership.clinic_id);
    const [clients, clientPets] = await Promise.all([
      client.getClient(id),
      client.getPets({ clientId: id }),
    ]);
    clientRecord = clients[0];
    pets = clientPets;
  } catch {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          No se pudo consultar esta ficha en GestorVet. Los datos de RECEPIA siguen disponibles.
        </div>
      </div>
    );
  }
  if (!clientRecord) notFound();

  const name = field(clientRecord, "NOMBRE");
  const phone = field(clientRecord, "MOVIL1", "TELEFONO1");
  const email = field(clientRecord, "EMAIL1");

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-stone-200 px-4 py-2">
        <Link
          className="inline-flex items-center rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          href="/clients"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-semibold text-stone-900">{name}</p>
            <Badge className="border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-50">
              GestorVet
            </Badge>
          </div>
          <p className="text-xs text-stone-500">Ficha externa · Solo lectura</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-6 p-6">
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-xs leading-5 text-violet-900">
            Esta información se consulta en vivo. Ningún cambio se envía todavía desde RECEPIA a
            GestorVet.
          </div>

          <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-card">
            <div className="flex items-center gap-2">
              <Database className="size-4 text-violet-600" />
              <h2 className="text-sm font-semibold text-stone-900">Información del cliente</h2>
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <Info label="ID GestorVet" value={id} />
              <Info label="Documento" value={field(clientRecord, "CIF")} />
              <Info label="Estado" value={field(clientRecord, "ESTADO")} />
              <Info label="Móvil" value={phone} />
              <Info label="Email" value={email} />
              <Info label="Nacimiento" value={field(clientRecord, "NACIMIENTO")} />
              <Info label="Dirección" value={field(clientRecord, "DIRECCION")} />
              <Info label="Código postal" value={field(clientRecord, "CP")} />
              <Info label="Población" value={field(clientRecord, "POBLACION")} />
              <Info label="Provincia" value={field(clientRecord, "PROVINCIA")} />
              <Info label="Idioma" value={field(clientRecord, "IDIOMA")} />
              <Info label="Observaciones" value={field(clientRecord, "OBSERVACIONES")} />
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PawPrint className="size-4 text-stone-500" />
                <h2 className="text-sm font-semibold text-stone-900">Mascotas</h2>
              </div>
              <span className="text-xs text-stone-400">{pets.length} vinculadas</span>
            </div>
            {pets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
                GestorVet no devolvió mascotas vinculadas.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {pets.map((pet) => (
                  <div
                    className="rounded-xl border border-stone-200 bg-white p-4 shadow-card"
                    key={field(pet, "ID")}
                  >
                    <p className="font-medium text-stone-900">{field(pet, "NOMBRE")}</p>
                    <div className="mt-2 space-y-1 text-xs text-stone-500">
                      <p>Especie: {field(pet, "ESPECIE")}</p>
                      <p>Raza: {field(pet, "RAZA")}</p>
                      <p>Sexo: {field(pet, "SEXO")}</p>
                      <p>Chip: {field(pet, "CHIP", "CHIP_TATUAJE")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
