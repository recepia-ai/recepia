import type { Database } from "@recepia/db";
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  FileText,
  FlaskConical,
  ImageIcon,
  NotebookPen,
  Pill,
  Stethoscope,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatClinicDate, formatClinicTime } from "@/lib/clinic-datetime";
import { createClient } from "@/lib/supabase/server";
import { PetEditorDialog } from "../../clients/_components/client-editors";
import { PetRecordDialog } from "../_components/pet-dialogs";

type PetRow = Database["public"]["Tables"]["pets"]["Row"] & {
  clients:
    | { id: string; name: string; phone: string }
    | { id: string; name: string; phone: string }[];
};
type RecordRow = Database["public"]["Tables"]["pet_records"]["Row"] & {
  signed_url: string | null;
};

const RECORD_LABELS: Record<string, { label: string; icon: typeof FileText; color: string }> = {
  pathology: { label: "Patología", icon: Stethoscope, color: "text-rose-600 bg-rose-50" },
  report: { label: "Informe", icon: FileText, color: "text-sky-600 bg-sky-50" },
  radiograph: { label: "Radiografía", icon: ImageIcon, color: "text-violet-600 bg-violet-50" },
  analysis: { label: "Analítica", icon: FlaskConical, color: "text-amber-600 bg-amber-50" },
  prescription: { label: "Prescripción", icon: Pill, color: "text-emerald-600 bg-emerald-50" },
  note: { label: "Nota clínica", icon: NotebookPen, color: "text-stone-600 bg-stone-100" },
};
const FALLBACK_RECORD = {
  label: "Nota clínica",
  icon: NotebookPen,
  color: "text-stone-600 bg-stone-100",
};

const SPECIES_LABELS: Record<string, string> = {
  dog: "Perro",
  cat: "Gato",
  rabbit: "Conejo",
  ferret: "Hurón",
  rodent: "Roedor",
  bird: "Ave",
  reptile: "Reptil",
  other: "Otra especie",
};

function formatDate(value: string): string {
  return formatClinicDate(value, { day: "numeric", month: "short", year: "numeric" });
}

export default async function PetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) notFound();
  const { data: membership } = await supabase
    .from("clinic_users")
    .select("clinic_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!membership) notFound();

  const [petResult, recordsResult, appointmentsResult] = await Promise.all([
    supabase
      .from("pets")
      .select("*, clients(id, name, phone)")
      .eq("id", id)
      .eq("clinic_id", membership.clinic_id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("pet_records")
      .select("*")
      .eq("pet_id", id)
      .eq("clinic_id", membership.clinic_id)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("appointments")
      .select("id, starts_at, status, notes, services(name)")
      .eq("pet_id", id)
      .eq("clinic_id", membership.clinic_id)
      .order("starts_at", { ascending: false })
      .limit(20),
  ]);

  if (!petResult.data) notFound();
  const pet = petResult.data as PetRow;
  const owner = Array.isArray(pet.clients) ? pet.clients[0] : pet.clients;
  if (!owner) notFound();

  const records: RecordRow[] = await Promise.all(
    (recordsResult.data ?? []).map(async (record) => {
      if (!record.file_path) return { ...record, signed_url: null };
      const signed = await supabase.storage
        .from("pet-records")
        .createSignedUrl(record.file_path, 3600);
      return { ...record, signed_url: signed.data?.signedUrl ?? null };
    }),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            href="/pets"
            className="mt-1 rounded-lg border border-stone-200 p-2 text-stone-500 hover:bg-stone-50"
            aria-label="Volver a mascotas"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{pet.name}</h1>
            <p className="mt-1 text-sm text-stone-500">
              {[SPECIES_LABELS[pet.species] ?? pet.species, pet.breed].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PetEditorDialog clientId={owner.id} pet={pet} />
          <PetRecordDialog petId={pet.id} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-card md:col-span-2">
          <h2 className="text-sm font-semibold text-stone-900">Ficha de la mascota</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <Data label="Nacimiento" value={pet.birth_date ? formatDate(pet.birth_date) : "—"} />
            <Data
              label="Sexo"
              value={pet.sex === "male" ? "Macho" : pet.sex === "female" ? "Hembra" : "—"}
            />
            <Data label="Peso" value={pet.weight_kg ? `${pet.weight_kg} kg` : "—"} />
            <Data label="Microchip" value={pet.microchip ?? "—"} />
            <Data label="Estado" value={pet.active ? "Activa" : "Inactiva"} />
            <Data label="Alta" value={formatDate(pet.created_at)} />
          </dl>
          {pet.notes && (
            <p className="mt-4 border-t border-stone-100 pt-4 text-sm text-stone-600">
              {pet.notes}
            </p>
          )}
        </section>

        <Link
          href={`/clients/${owner.id}`}
          className="rounded-xl border border-stone-200 bg-white p-5 shadow-card transition hover:border-emerald-200"
        >
          <div className="flex size-9 items-center justify-center rounded-full bg-emerald-50">
            <UserRound className="size-4 text-emerald-700" />
          </div>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-stone-400">
            Propietario
          </p>
          <p className="mt-1 font-semibold text-stone-900">{owner.name}</p>
          <p className="mt-0.5 text-sm text-stone-500">{owner.phone}</p>
        </Link>
      </div>

      <section>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-stone-900">Historial clínico</h2>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
            {records.length}
          </span>
        </div>
        {records.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-stone-200 bg-white py-12 text-center">
            <FileText className="mx-auto size-6 text-stone-300" />
            <p className="mt-2 text-sm text-stone-500">Todavía no hay entradas clínicas</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {records.map((record) => {
              const config = RECORD_LABELS[record.record_type] ?? FALLBACK_RECORD;
              const Icon = config.icon;
              const href = record.signed_url ?? record.external_url;
              return (
                <article
                  key={record.id}
                  className="rounded-xl border border-stone-200 bg-white p-5 shadow-card"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${config.color}`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-stone-900">{record.title}</p>
                          <p className="mt-0.5 text-xs text-stone-500">
                            {config.label} · {formatDate(record.occurred_at)}
                          </p>
                        </div>
                        {href && (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                          >
                            {record.file_name ?? "Abrir documento"}{" "}
                            <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                      {record.description && (
                        <p className="mt-3 whitespace-pre-wrap text-sm text-stone-600">
                          {record.description}
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="pb-8">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-stone-900">Visitas y citas</h2>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
            {appointmentsResult.data?.length ?? 0}
          </span>
        </div>
        <div className="mt-4 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
          {(appointmentsResult.data ?? []).length === 0 ? (
            <p className="p-6 text-center text-sm text-stone-500">No hay visitas registradas</p>
          ) : (
            (appointmentsResult.data ?? []).map((appointment) => {
              const service = Array.isArray(appointment.services)
                ? appointment.services[0]
                : appointment.services;
              return (
                <div key={appointment.id} className="flex items-center gap-3 px-4 py-3">
                  <CalendarDays className="size-4 text-stone-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-stone-800">
                      {service?.name ?? "Visita veterinaria"}
                    </p>
                    <p className="text-xs text-stone-500">
                      {formatDate(appointment.starts_at)} ·{" "}
                      {formatClinicTime(appointment.starts_at)} · {appointment.status}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function Data({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-stone-700">{value}</dd>
    </div>
  );
}
