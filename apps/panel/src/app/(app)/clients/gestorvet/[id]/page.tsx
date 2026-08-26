import { ArrowLeft, Database, PawPrint } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import type { GestorVetRecord } from "@/lib/gestorvet/client";
import { readGestorVetClient } from "@/lib/gestorvet/discovery";
import {
  gestorVetLookup,
  gestorVetResolvedValue,
  gestorVetValue,
} from "@/lib/gestorvet/native-adapters";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

function field(record: GestorVetRecord, ...keys: string[]): string {
  return gestorVetValue(record, ...keys) ?? "—";
}

function Info({ label, value, code }: { label: string; value: string; code?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">{label}</p>
      <p className="mt-1 break-words text-sm text-stone-700">{value}</p>
      {code && value !== `Código ${code}` && (
        <p className="mt-0.5 text-[10px] text-stone-400">Código GestorVet: {code}</p>
      )}
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
  let populations = new Map<string, string>();
  let provinces = new Map<string, string>();
  let clientGroups = new Map<string, string>();
  let languages = new Map<string, string>();
  let species = new Map<string, string>();
  let breeds = new Map<string, string>();
  let petStatuses = new Map<string, string>();
  let petSexes = new Map<string, string>();
  let users = new Map<string, string>();
  try {
    const { client } = await readGestorVetClient(createAdminClient(), membership.clinic_id);
    const [
      clients,
      clientPets,
      populationRows,
      provinceRows,
      groupRows,
      languageRows,
      speciesRows,
      breedRows,
      statusRows,
      sexRows,
      userRows,
    ] = await Promise.all([
      client.getClient(id),
      client.getPets({ clientId: id }),
      client.getPopulations(),
      client.getProvinces(),
      client.getClientGroups(),
      client.getMessageLanguages(),
      client.getSpecies(),
      client.getBreeds(),
      client.getPetStatuses(),
      client.getPetSexes(),
      client.getUsers(),
    ]);
    clientRecord = clients[0];
    pets = clientPets;
    populations = gestorVetLookup(populationRows);
    provinces = gestorVetLookup(provinceRows);
    clientGroups = gestorVetLookup(groupRows);
    languages = gestorVetLookup(languageRows);
    species = gestorVetLookup(speciesRows);
    breeds = gestorVetLookup(breedRows);
    petStatuses = gestorVetLookup(statusRows);
    petSexes = gestorVetLookup(sexRows);
    users = gestorVetLookup(userRows);
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
  const population = gestorVetResolvedValue(clientRecord, populations, "POBLACION");
  const province = gestorVetResolvedValue(clientRecord, provinces, "PROVINCIA");
  const group = gestorVetResolvedValue(clientRecord, clientGroups, "GRUPO", "TIPO_CLIENTE_ID");
  const language = gestorVetResolvedValue(clientRecord, languages, "IDIOMA");
  const clientStatusCode = gestorVetValue(clientRecord, "ESTADO");
  const clientStatus = clientStatusCode === "1" ? "Alta" : clientStatusCode === "2" ? "Baja" : "—";

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
              <Info label="Estado" value={clientStatus} code={clientStatusCode} />
              <Info label="Móvil" value={phone} />
              <Info label="Email" value={email} />
              <Info label="Nacimiento" value={field(clientRecord, "NACIMIENTO")} />
              <Info label="Dirección" value={field(clientRecord, "DIRECCION")} />
              <Info label="Código postal" value={field(clientRecord, "CP")} />
              <Info label="Población" value={population.label} code={population.code} />
              <Info label="Provincia" value={province.label} code={province.code} />
              <Info label="Grupo de cliente" value={group.label} code={group.code} />
              <Info label="Idioma" value={language.label} code={language.code} />
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
                {pets.map((pet) => {
                  const petSpecies = gestorVetResolvedValue(pet, species, "ESPECIE");
                  const petBreed = gestorVetResolvedValue(pet, breeds, "RAZA");
                  const petStatus = gestorVetResolvedValue(pet, petStatuses, "ESTADO");
                  const petSex = gestorVetResolvedValue(pet, petSexes, "SEXO");
                  const usualVet = gestorVetResolvedValue(
                    pet,
                    users,
                    "VETERINARIO",
                    "VETERINARIO_HABITUAL",
                  );
                  return (
                    <div
                      className="rounded-xl border border-stone-200 bg-white p-4 shadow-card"
                      key={field(pet, "ID")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-stone-900">{field(pet, "NOMBRE")}</p>
                        <span className="text-[10px] text-stone-400">ID {field(pet, "ID")}</span>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <Info label="Especie" value={petSpecies.label} code={petSpecies.code} />
                        <Info label="Raza" value={petBreed.label} code={petBreed.code} />
                        <Info label="Sexo" value={petSex.label} code={petSex.code} />
                        <Info label="Estado" value={petStatus.label} code={petStatus.code} />
                        <Info label="Nacimiento" value={field(pet, "NACIMIENTO")} />
                        <Info label="Edad" value={field(pet, "EDADENMESES")} />
                        <Info label="Peso" value={field(pet, "PESO")} />
                        <Info label="Chip" value={field(pet, "CHIP", "CHIP_TATUAJE")} />
                        <Info label="NHC" value={field(pet, "NHC")} />
                        <Info
                          label="Veterinario habitual"
                          value={usualVet.label}
                          code={usualVet.code}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
