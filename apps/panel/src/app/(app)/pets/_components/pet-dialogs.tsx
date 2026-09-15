"use client";

import { FilePlus2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { savePetDetails } from "../../clients/client-actions";
import { createPetRecord } from "../pet-actions";

type ClientOption = { id: string; name: string; phone: string };

const selectClass =
  "h-9 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none focus:border-emerald-500";
const textareaClass =
  "min-h-24 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15";

export function PetCreateDialog({ clients }: { clients: ClientOption[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clientQuery, setClientQuery] = useState("");
  const router = useRouter();
  const visibleClients = useMemo(() => {
    const query = clientQuery.trim().toLocaleLowerCase("es-ES");
    if (!query) return clients;
    return clients.filter((client) =>
      `${client.name} ${client.phone}`.toLocaleLowerCase("es-ES").includes(query),
    );
  }, [clientQuery, clients]);

  async function submit(formData: FormData) {
    setBusy(true);
    try {
      const result = await savePetDetails(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Mascota creada y vinculada");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Nueva mascota
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nueva mascota</DialogTitle>
          <DialogDescription>
            Selecciona el propietario y completa la ficha básica.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pet-owner-search">Propietario</Label>
            <Input
              id="pet-owner-search"
              value={clientQuery}
              onChange={(event) => setClientQuery(event.target.value)}
              placeholder="Filtrar clientes por nombre o teléfono"
            />
            <select name="client_id" required className={selectClass} defaultValue="">
              <option value="" disabled>
                Selecciona un cliente
              </option>
              {visibleClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} · {client.phone}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" name="name" required />
            <SelectField label="Especie" name="species" defaultValue="dog">
              <option value="dog">Perro</option>
              <option value="cat">Gato</option>
              <option value="rabbit">Conejo</option>
              <option value="ferret">Hurón</option>
              <option value="rodent">Roedor</option>
              <option value="bird">Ave</option>
              <option value="reptile">Reptil</option>
              <option value="other">Otra</option>
            </SelectField>
            <Field label="Raza" name="breed" />
            <Field label="Fecha de nacimiento" name="birth_date" type="date" />
            <SelectField label="Sexo" name="sex" defaultValue="unknown">
              <option value="unknown">Sin especificar</option>
              <option value="male">Macho</option>
              <option value="female">Hembra</option>
            </SelectField>
            <Field label="Microchip" name="microchip" />
            <Field label="Peso (kg)" name="weight_kg" type="number" step="0.01" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pet-notes">Notas</Label>
            <textarea id="new-pet-notes" name="notes" className={textareaClass} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy || clients.length === 0}>
              {busy ? "Guardando…" : "Crear mascota"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PetRecordDialog({ petId }: { petId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(formData: FormData) {
    setBusy(true);
    try {
      const result = await createPetRecord(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Entrada añadida al historial");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <FilePlus2 className="size-4" /> Añadir al historial
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva entrada clínica</DialogTitle>
          <DialogDescription>
            Registra patologías, informes, radiografías y otros documentos de la mascota.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <input type="hidden" name="pet_id" value={petId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Tipo" name="record_type" defaultValue="pathology">
              <option value="pathology">Patología</option>
              <option value="report">Informe</option>
              <option value="radiograph">Radiografía</option>
              <option value="analysis">Analítica</option>
              <option value="prescription">Prescripción</option>
              <option value="note">Nota clínica</option>
            </SelectField>
            <Field
              label="Fecha"
              name="occurred_at"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
          <Field label="Título" name="title" required />
          <div className="space-y-1.5">
            <Label htmlFor="record-description">Descripción</Label>
            <textarea id="record-description" name="description" className={textareaClass} />
          </div>
          <Field label="Enlace externo" name="external_url" type="url" placeholder="https://…" />
          <div className="space-y-1.5">
            <Label htmlFor="record-file">Archivo privado</Label>
            <Input
              id="record-file"
              name="file"
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
            />
            <p className="text-[11px] text-stone-400">PDF o imagen · máximo 20 MB</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Guardando…" : "Guardar entrada"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  name,
  ...props
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}

function SelectField({
  label,
  name,
  children,
  defaultValue,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
  defaultValue: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} defaultValue={defaultValue} className={selectClass}>
        {children}
      </select>
    </div>
  );
}
