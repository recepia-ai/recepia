"use client";

import type { Database } from "@recepia/db";
import { Pencil, Plus, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { createClientDetails, savePetDetails, updateClientDetails } from "../client-actions";

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
type PetRow = Database["public"]["Tables"]["pets"]["Row"];

const fieldClass =
  "min-h-20 w-full rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15";
const selectClass =
  "h-8 w-full rounded-lg border border-stone-200 bg-white px-2.5 text-sm outline-none focus:border-emerald-500";

export function CreateClientDialog() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(formData: FormData) {
    setBusy(true);
    try {
      const result = await createClientDetails(formData);
      if (result.error || !result.clientId) {
        toast.error(result.error ?? "No se pudo crear el cliente");
        return;
      }
      toast.success("Cliente creado");
      setOpen(false);
      router.push(`/clients/${result.clientId}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="size-3.5" /> Nuevo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
          <DialogDescription>
            El teléfono es el identificador principal para reconocer futuras conversaciones.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre completo" name="name" required />
            <Field label="Teléfono" name="phone" defaultValue="+34" required />
            <Field label="Email" name="email" type="email" />
            <Field label="DNI / NIE" name="document_id" />
            <div className="space-y-1.5">
              <Label htmlFor="new-client-language">Idioma preferido</Label>
              <select
                id="new-client-language"
                name="preferred_language"
                defaultValue="es"
                className={selectClass}
              >
                <option value="es">Español</option>
                <option value="ca">Català</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="it">Italiano</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-client-notes">Notas</Label>
            <textarea id="new-client-notes" name="notes" className={fieldClass} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Creando…" : "Crear cliente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditClientDialog({ client }: { client: ClientRow }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(formData: FormData) {
    setBusy(true);
    try {
      const result = await updateClientDetails(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Cliente actualizado");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-3.5" /> Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
          <DialogDescription>
            El teléfono y el DNI/NIE se usan para reconocer su ficha en las conversaciones.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <input type="hidden" name="client_id" value={client.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre completo" name="name" defaultValue={client.name} required />
            <Field label="Teléfono" name="phone" defaultValue={client.phone} required />
            <Field label="Email" name="email" type="email" defaultValue={client.email ?? ""} />
            <Field label="DNI / NIE" name="document_id" defaultValue={client.document_id ?? ""} />
            <div className="space-y-1.5">
              <Label htmlFor="preferred_language">Idioma preferido</Label>
              <select
                id="preferred_language"
                name="preferred_language"
                defaultValue={client.preferred_language}
                className={selectClass}
              >
                <option value="es">Español</option>
                <option value="ca">Català</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="it">Italiano</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client_notes">Notas</Label>
            <textarea
              id="client_notes"
              name="notes"
              defaultValue={client.notes ?? ""}
              className={fieldClass}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PetEditorDialog({ clientId, pet }: { clientId: string; pet?: PetRow }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(formData: FormData) {
    setBusy(true);
    try {
      const result = await savePetDetails(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(pet ? "Mascota actualizada" : "Mascota añadida");
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {pet ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Editar ${pet.name}`}>
            <Pencil className="size-3.5" />
          </Button>
        ) : (
          <Button variant="outline" size="sm">
            <Plus className="size-3.5" /> Añadir mascota
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{pet ? `Editar ${pet.name}` : "Añadir mascota"}</DialogTitle>
          <DialogDescription>
            El nombre y el microchip también se incluyen en las búsquedas.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <input type="hidden" name="client_id" value={clientId} />
          {pet && <input type="hidden" name="pet_id" value={pet.id} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" name="name" defaultValue={pet?.name ?? ""} required />
            <div className="space-y-1.5">
              <Label htmlFor={`species-${pet?.id ?? "new"}`}>Especie</Label>
              <select
                id={`species-${pet?.id ?? "new"}`}
                name="species"
                defaultValue={pet?.species ?? "dog"}
                className={selectClass}
              >
                <option value="dog">Perro</option>
                <option value="cat">Gato</option>
                <option value="rabbit">Conejo</option>
                <option value="ferret">Hurón</option>
                <option value="rodent">Roedor</option>
                <option value="bird">Ave</option>
                <option value="reptile">Reptil</option>
                <option value="other">Otra</option>
              </select>
            </div>
            <Field label="Raza" name="breed" defaultValue={pet?.breed ?? ""} />
            <Field
              label="Fecha de nacimiento"
              name="birth_date"
              type="date"
              defaultValue={pet?.birth_date ?? ""}
            />
            <div className="space-y-1.5">
              <Label htmlFor={`sex-${pet?.id ?? "new"}`}>Sexo</Label>
              <select
                id={`sex-${pet?.id ?? "new"}`}
                name="sex"
                defaultValue={pet?.sex ?? "unknown"}
                className={selectClass}
              >
                <option value="unknown">Sin especificar</option>
                <option value="male">Macho</option>
                <option value="female">Hembra</option>
              </select>
            </div>
            <Field label="Microchip" name="microchip" defaultValue={pet?.microchip ?? ""} />
            <Field
              label="Peso (kg)"
              name="weight_kg"
              type="number"
              step="0.01"
              defaultValue={pet?.weight_kg?.toString() ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`pet-notes-${pet?.id ?? "new"}`}>Notas</Label>
            <textarea
              id={`pet-notes-${pet?.id ?? "new"}`}
              name="notes"
              defaultValue={pet?.notes ?? ""}
              className={fieldClass}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Guardando…" : "Guardar"}
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
