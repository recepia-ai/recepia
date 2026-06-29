"use client";

import {
  useState,
  useEffect,
  useTransition,
  useCallback,
  useRef,
} from "react";
import { toast } from "sonner";
import {
  Loader2,
  X,
  Plus,
  ChevronDown,
  Search,
  UserPlus,
  PawPrint,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AvailableSlot } from "@/app/(app)/_actions/availability-actions";
import type {
  ClientOption,
  PetOption,
} from "../_schemas/test-schemas";
import { createClientSchema, createPetSchema } from "../_schemas/test-schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  slot: AvailableSlot | null;
  open: boolean;
  onClose: () => void;
  /** Called when createAppointment returns SLOT_NO_LONGER_AVAILABLE */
  onSlotGone: () => void;
  /** Service ID from the search form */
  serviceId: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateAppointmentModal({
  slot,
  open,
  onClose,
  onSlotGone,
  serviceId,
}: Props) {
  const [isPending, startTransition] = useTransition();

  // Client search state
  const [clientQuery, setClientQuery] = useState("");
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);

  // Selected client
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const selectedClient = clientOptions.find((c) => c.id === selectedClientId);

  // Pets for selected client
  const [petOptions, setPetOptions] = useState<PetOption[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string>("");

  // Create-new tabs
  const [newClientMode, setNewClientMode] = useState(false);
  const [newPetMode, setNewPetMode] = useState(false);

  // Form fields — new client
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("+34");

  // Form fields — new pet
  const [newPetName, setNewPetName] = useState("");
  const [newPetSpecies, setNewPetSpecies] = useState<string>("dog");
  const [newPetBreed, setNewPetBreed] = useState("");

  // Notes
  const [notes, setNotes] = useState("");

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setClientQuery("");
      setClientOptions([]);
      setSelectedClientId("");
      setPetOptions([]);
      setSelectedPetId("");
      setNewClientMode(false);
      setNewPetMode(false);
      setNewClientName("");
      setNewClientPhone("+34");
      setNewPetName("");
      setNewPetSpecies("dog");
      setNewPetBreed("");
      setNotes("");
    }
  }, [open]);

  // Debounced client search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClientSearch = useCallback(
    (q: string) => {
      setClientQuery(q);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (q.length < 2) {
        setClientOptions([]);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        setSearchingClients(true);
        try {
          const { searchClients } = await import("../_actions/test-actions");
          const result = await searchClients(q);
          setSearchingClients(false);
          if ("error" in result) {
            toast.error(result.error);
            return;
          }
          setClientOptions(result.clients);
        } catch {
          setSearchingClients(false);
        }
      }, 300);
    },
    [],
  );

  // Load pets when client selected
  useEffect(() => {
    if (!selectedClientId) {
      setPetOptions([]);
      return;
    }

    async function load() {
      const { loadPets } = await import("../_actions/test-actions");
      const result = await loadPets(selectedClientId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setPetOptions(result.pets);
    }

    load();
  }, [selectedClientId]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ------------------------------------------------------------------
  // Submit
  // ------------------------------------------------------------------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!slot) return;

    // Validate client
    let clientId: string;

    if (!newClientMode && selectedClientId) {
      clientId = selectedClientId;
    } else if (newClientMode) {
      const parsed = createClientSchema.safeParse({
        phone: newClientPhone,
        name: newClientName,
      });
      if (!parsed.success) {
        toast.error(
          parsed.error.issues.map((i) => i.message).join(", "),
        );
        return;
      }

      const { createClientAction } = await import("../_actions/test-actions");
      const result = await createClientAction(parsed.data);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      clientId = result.client_id;
    } else {
      toast.error("Selecciona o crea un cliente.");
      return;
    }

    // Validate pet
    let petId: string;

    if (!newPetMode && selectedPetId) {
      petId = selectedPetId;
    } else if (newPetMode) {
      const parsed = createPetSchema.safeParse({
        name: newPetName,
        species: newPetSpecies,
        breed: newPetBreed || undefined,
      });
      if (!parsed.success) {
        toast.error(
          parsed.error.issues.map((i) => i.message).join(", "),
        );
        return;
      }

      const { createPetAction } = await import("../_actions/test-actions");
      const result = await createPetAction({
        ...parsed.data,
        client_id: clientId,
        breed: parsed.data.breed || undefined,
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      petId = result.pet_id;
    } else {
      toast.error("Selecciona o crea una mascota.");
      return;
    }

    // Create appointment
    startTransition(async () => {
      const { createAppointmentWrapper } = await import(
        "../_actions/test-actions"
      );

      const result = await createAppointmentWrapper({
        client_id: clientId!,
        pet_id: petId!,
        vet_user_id: slot.vet_user_id,
        service_id: serviceId,
        starts_at: slot.starts_at,
        notes: notes || undefined,
        created_by: "admin",
      });

      if ("error" in result) {
        if (result.error === "SLOT_NO_LONGER_AVAILABLE") {
          toast.warning(
            "El slot ya no está libre, refresca la búsqueda",
          );
          onSlotGone();
          onClose();
          return;
        }

        if (
          result.error ===
          "La conexión con Google Calendar ha expirado. Por favor, reconecta la integración."
        ) {
          toast.error("Reconecta Google Calendar en Integraciones", {
            action: {
              label: "Ir",
              onClick: () =>
                (window.location.href = "/settings/integrations"),
            },
          });
          return;
        }

        toast.error(result.error);
        return;
      }

      toast.success(
        `Cita creada · ID: ${result.appointment_id}`,
      );
      onClose();
      // Refresh the page so the server component re-fetches
      window.location.reload();
    });
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  if (!open || !slot) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">
              Crear cita de prueba
            </h2>
            <p className="mt-0.5 text-xs text-stone-500">
              {slot.vet_name} · {new Date(slot.starts_at).toLocaleString("es-ES", {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* ---- Client section ---- */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-stone-600">
                Cliente
              </label>
              <button
                type="button"
                className={cn(
                  "text-xs font-medium flex items-center gap-1",
                  newClientMode ? "text-stone-400" : "text-emerald-600",
                )}
                onClick={() => {
                  setNewClientMode(!newClientMode);
                  if (newClientMode) {
                    setSelectedClientId("");
                  } else {
                    setClientQuery("");
                    setClientOptions([]);
                    setSelectedClientId("");
                  }
                }}
              >
                {newClientMode ? (
                  <>
                    <Search className="size-3" />
                    Buscar existente
                  </>
                ) : (
                  <>
                    <UserPlus className="size-3" />
                    Crear nuevo
                  </>
                )}
              </button>
            </div>

            {newClientMode ? (
              /* -- New client form -- */
              <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Nombre completo"
                  className={cn(
                    "w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm",
                    "focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500",
                  )}
                  required
                />
                <input
                  type="tel"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  placeholder="+34600000000"
                  className={cn(
                    "w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm",
                    "focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500",
                  )}
                  required
                />
              </div>
            ) : (
              /* -- Search existing clients -- */
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-stone-400" />
                  <input
                    type="text"
                    value={clientQuery}
                    onChange={(e) => handleClientSearch(e.target.value)}
                    placeholder="Buscar por nombre o teléfono…"
                    className={cn(
                      "w-full rounded-lg border border-stone-200 bg-white pl-9 pr-3 py-2 text-sm",
                      "focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500",
                    )}
                  />
                  {searchingClients && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-stone-400" />
                  )}
                </div>

                {clientOptions.length > 0 && (
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-stone-200 divide-y divide-stone-100">
                    {clientOptions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm flex items-center justify-between",
                          selectedClientId === c.id
                            ? "bg-emerald-50 text-emerald-900"
                            : "text-stone-700 hover:bg-stone-50",
                        )}
                        onClick={() => {
                          setSelectedClientId(c.id);
                          setClientQuery(c.name);
                        }}
                      >
                        <span>
                          <span className="font-medium">{c.name}</span>
                          <span className="ml-2 text-xs text-stone-400">
                            {c.phone}
                          </span>
                        </span>
                        {selectedClientId === c.id && (
                          <span className="text-[10px] text-emerald-600 font-medium">
                            SELEC.
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {clientQuery.length >= 2 &&
                  !searchingClients &&
                  clientOptions.length === 0 && (
                    <p className="text-xs text-stone-400">
                      Sin resultados.{" "}
                      <button
                        type="button"
                        className="text-emerald-600 underline"
                        onClick={() => setNewClientMode(true)}
                      >
                        Crear nuevo
                      </button>
                    </p>
                  )}
              </div>
            )}
          </div>

          {/* ---- Pet section ---- */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-stone-600">
                Mascota
              </label>
              {selectedClientId && !newClientMode && (
                <button
                  type="button"
                  className={cn(
                    "text-xs font-medium flex items-center gap-1",
                    newPetMode ? "text-stone-400" : "text-emerald-600",
                  )}
                  onClick={() => {
                    setNewPetMode(!newPetMode);
                    if (newPetMode) setSelectedPetId("");
                  }}
                >
                  {newPetMode ? (
                    <>
                      <PawPrint className="size-3" />
                      Seleccionar existente
                    </>
                  ) : (
                    <>
                      <Plus className="size-3" />
                      Crear nueva
                    </>
                  )}
                </button>
              )}
            </div>

            {newPetMode ? (
              /* -- New pet form -- */
              <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
                <input
                  type="text"
                  value={newPetName}
                  onChange={(e) => setNewPetName(e.target.value)}
                  placeholder="Nombre de la mascota"
                  className={cn(
                    "w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm",
                    "focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500",
                  )}
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <Select value={newPetSpecies} onValueChange={setNewPetSpecies}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dog">Perro</SelectItem>
                      <SelectItem value="cat">Gato</SelectItem>
                    </SelectContent>
                  </Select>
                  <input
                    type="text"
                    value={newPetBreed}
                    onChange={(e) => setNewPetBreed(e.target.value)}
                    placeholder="Raza (opcional)"
                    className={cn(
                      "w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm",
                      "focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500",
                    )}
                  />
                </div>
              </div>
            ) : (
              /* -- Select existing pet -- */
              <>
                {selectedClientId ? (
                  petOptions.length > 0 ? (
                    <div className="max-h-32 overflow-y-auto rounded-lg border border-stone-200 divide-y divide-stone-100">
                      {petOptions.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={cn(
                            "w-full text-left px-3 py-2 text-sm flex items-center justify-between",
                            selectedPetId === p.id
                              ? "bg-emerald-50 text-emerald-900"
                              : "text-stone-700 hover:bg-stone-50",
                          )}
                          onClick={() => setSelectedPetId(p.id)}
                        >
                          <span>
                            <span className="font-medium">{p.name}</span>
                            <span className="ml-2 text-xs text-stone-400 capitalize">
                              {p.species}
                            </span>
                          </span>
                          {selectedPetId === p.id && (
                            <span className="text-[10px] text-emerald-600 font-medium">
                              SELEC.
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-400">
                      Este cliente no tiene mascotas.{" "}
                      <button
                        type="button"
                        className="text-emerald-600 underline"
                        onClick={() => setNewPetMode(true)}
                      >
                        Crear una
                      </button>
                    </p>
                  )
                ) : (
                  <p className="text-xs text-stone-400">
                    Selecciona o crea un cliente primero.
                  </p>
                )}
              </>
            )}
          </div>

          {/* ---- Notes ---- */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-600">
              Notas{" "}
              <span className="text-stone-400">
                (se añadirá prefijo [TEST])
              </span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Información adicional para la cita…"
              rows={2}
              className={cn(
                "w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm resize-none",
                "focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500",
              )}
            />
            <p className="mt-1 text-[10px] text-stone-400">
              Las notas se guardarán como: [TEST] {notes || "cita de prueba desde panel admin"}
            </p>
          </div>

          {/* ---- Submit ---- */}
          <div className="flex items-center gap-3 pt-2 border-t border-stone-100">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-stone-500"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="flex-1"
              variant="default"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creando cita…
                </>
              ) : (
                "Crear cita de prueba"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
