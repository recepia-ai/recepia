"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DATABASE_UUID_PATTERN, euroInputToCents, serviceSlug } from "@/lib/operations-config";
import { getAdminSettingsContext } from "../operations-context";

export type ServiceActionState = { success?: boolean; error?: string };

const priceSchema = z
  .string()
  .trim()
  .regex(/^$|^\d+(?:[.,]\d{1,2})?$/, "Precio no válido");
const databaseIdSchema = z.string().regex(DATABASE_UUID_PATTERN, "Identificador no válido");
const serviceFormSchema = z.object({
  service_id: databaseIdSchema.optional(),
  name: z.string().trim().min(2, "El nombre es demasiado corto").max(120),
  description: z.string().trim().max(600).optional().default(""),
  duration_minutes: z.coerce.number().int().min(5).max(480),
  price_min: priceSchema,
  price_max: priceSchema,
  is_surgery: z.boolean(),
  requires_fasting: z.boolean(),
  escalates_for_pricing: z.boolean(),
});

function serviceInput(formData: FormData) {
  return serviceFormSchema.safeParse({
    service_id: formData.get("service_id") || undefined,
    name: formData.get("name"),
    description: formData.get("description"),
    duration_minutes: formData.get("duration_minutes"),
    price_min: formData.get("price_min") ?? "",
    price_max: formData.get("price_max") ?? "",
    is_surgery: formData.get("is_surgery") === "true",
    requires_fasting: formData.get("requires_fasting") === "true",
    escalates_for_pricing: formData.get("escalates_for_pricing") === "true",
  });
}

function servicePayload(data: z.infer<typeof serviceFormSchema>) {
  const priceMin = euroInputToCents(data.price_min);
  const priceMax = euroInputToCents(data.price_max);
  if (priceMin !== null && priceMax !== null && priceMax < priceMin) {
    return { error: "El precio máximo no puede ser menor que el mínimo." } as const;
  }
  return {
    payload: {
      name: data.name,
      description: data.description || null,
      duration_minutes: data.duration_minutes,
      price_min_cents: priceMin,
      price_max_cents: priceMax,
      is_surgery: data.is_surgery,
      requires_fasting: data.requires_fasting,
      escalates_for_pricing: data.escalates_for_pricing,
    },
  } as const;
}

function refreshServices() {
  revalidatePath("/settings/services");
  revalidatePath("/calendar");
  revalidatePath("/settings/test-availability");
}

export async function createService(
  _previous: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  const contextResult = await getAdminSettingsContext();
  if (!contextResult.ok) return { error: contextResult.error };
  const parsed = serviceInput(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const normalized = servicePayload(parsed.data);
  if ("error" in normalized) return normalized;
  const slug = serviceSlug(parsed.data.name);
  if (!slug) return { error: "El nombre no genera un identificador válido." };

  const { supabase, clinicId } = contextResult.context;
  const { data, error } = await supabase
    .from("services")
    .insert({ clinic_id: clinicId, slug, active: true, ...normalized.payload })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[createService]", { code: error.code, message: error.message });
    return {
      error:
        error.code === "23505"
          ? "Ya existe un servicio con ese nombre o identificador."
          : "No se pudo crear el servicio.",
    };
  }
  if (!data) return { error: "No se pudo crear el servicio." };
  refreshServices();
  return { success: true };
}

export async function updateService(
  _previous: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  const contextResult = await getAdminSettingsContext();
  if (!contextResult.ok) return { error: contextResult.error };
  const parsed = serviceInput(formData);
  if (!parsed.success || !parsed.data.service_id) {
    return { error: parsed.success ? "Servicio no válido" : parsed.error.issues[0]?.message };
  }
  const normalized = servicePayload(parsed.data);
  if ("error" in normalized) return normalized;
  const { supabase, clinicId } = contextResult.context;
  const { data, error } = await supabase
    .from("services")
    .update(normalized.payload)
    .eq("id", parsed.data.service_id)
    .eq("clinic_id", clinicId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[updateService]", { code: error.code, message: error.message });
    return { error: "No se pudo actualizar el servicio." };
  }
  if (!data) return { error: "Servicio no encontrado en esta clínica." };
  refreshServices();
  return { success: true };
}

export async function setServiceActive(
  serviceId: string,
  active: boolean,
): Promise<ServiceActionState> {
  const parsedId = databaseIdSchema.safeParse(serviceId);
  if (!parsedId.success) return { error: "Servicio no válido" };
  const contextResult = await getAdminSettingsContext();
  if (!contextResult.ok) return { error: contextResult.error };
  const { supabase, clinicId } = contextResult.context;
  const { data, error } = await supabase
    .from("services")
    .update({ active })
    .eq("id", parsedId.data)
    .eq("clinic_id", clinicId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "No se pudo cambiar el estado del servicio." };
  refreshServices();
  return { success: true };
}

export async function saveServiceAssignments(
  serviceId: string,
  vetIds: string[],
): Promise<ServiceActionState> {
  const parsed = z
    .object({ serviceId: databaseIdSchema, vetIds: z.array(databaseIdSchema) })
    .safeParse({
      serviceId,
      vetIds: [...new Set(vetIds)],
    });
  if (!parsed.success) return { error: "Asignación no válida" };
  const contextResult = await getAdminSettingsContext();
  if (!contextResult.ok) return { error: contextResult.error };
  const { supabase, clinicId } = contextResult.context;

  const [serviceResult, vetsResult, existingResult] = await Promise.all([
    supabase
      .from("services")
      .select("id")
      .eq("id", parsed.data.serviceId)
      .eq("clinic_id", clinicId)
      .maybeSingle(),
    parsed.data.vetIds.length
      ? supabase
          .from("clinic_users")
          .select("id")
          .eq("clinic_id", clinicId)
          .eq("staff_type", "vet")
          .in("id", parsed.data.vetIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("service_vet_assignments")
      .select("id, vet_user_id")
      .eq("clinic_id", clinicId)
      .eq("service_id", parsed.data.serviceId),
  ]);

  if (serviceResult.error || vetsResult.error || existingResult.error) {
    return { error: "No se pudo verificar la configuración actual." };
  }
  const service = serviceResult.data;
  const vets = vetsResult.data;
  const existing = existingResult.data;
  if (!service) return { error: "Servicio no encontrado en esta clínica." };
  if ((vets ?? []).length !== parsed.data.vetIds.length) {
    return { error: "Hay un veterinario inválido o de otra clínica." };
  }

  const existingIds = new Set((existing ?? []).map((row) => row.vet_user_id));
  const requestedIds = new Set(parsed.data.vetIds);
  const toAdd = parsed.data.vetIds.filter((id) => !existingIds.has(id));
  const toRemove = (existing ?? []).filter((row) => !requestedIds.has(row.vet_user_id));

  if (toAdd.length) {
    const { error } = await supabase.from("service_vet_assignments").insert(
      toAdd.map((vetUserId) => ({
        clinic_id: clinicId,
        service_id: parsed.data.serviceId,
        vet_user_id: vetUserId,
      })),
    );
    if (error) return { error: "No se pudieron añadir las asignaciones." };
  }
  if (toRemove.length) {
    const { error } = await supabase
      .from("service_vet_assignments")
      .delete()
      .eq("clinic_id", clinicId)
      .in(
        "id",
        toRemove.map((row) => row.id),
      );
    if (error) return { error: "No se pudieron quitar las asignaciones." };
  }

  refreshServices();
  return { success: true };
}
