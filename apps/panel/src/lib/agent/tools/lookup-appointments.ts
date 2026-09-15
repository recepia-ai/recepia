import { z } from "zod";
import { classifyAppointmentResolution } from "@/lib/agent/appointment-management";
import { uuidSchema } from "@/lib/uuid-schema";
import type { Tool, ToolContext, ToolResult } from "./types";

const inputSchema = z.object({
  client_id: uuidSchema.describe("ID del cliente cuyas citas buscar"),
  pet_id: uuidSchema.optional().describe("Opcional: filtrar solo citas de esa mascota"),
  vet_user_id: uuidSchema.optional().describe("Opcional: filtrar por veterinario"),
  service_id: uuidSchema.optional().describe("Opcional: filtrar por servicio"),
  status: z.enum(["confirmed", "completed", "cancelled"]).optional().describe("Filtrar por estado"),
  date_from: z.string().datetime({ offset: true }).optional().describe("Inicio del rango de fecha"),
  date_to: z.string().datetime({ offset: true }).optional().describe("Fin del rango de fecha"),
  upcoming_only: z.boolean().optional().describe("Solo citas futuras desde ahora"),
});

type Input = z.infer<typeof inputSchema>;

type AppointmentRow = {
  id: string;
  pet_id: string | null;
  service_id: string | null;
  vet_user_id: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  service_name: string;
  vet_name: string;
  pet_name: string;
  notes: string | null;
};

type Output = {
  appointments: AppointmentRow[];
  resolution: "none" | "unique" | "ambiguous";
};

async function handler(input: Input, ctx: ToolContext): Promise<ToolResult<Output>> {
  const supabase = ctx.supabaseAdmin;

  let query = supabase
    .from("appointments")
    .select(`
      id,
      starts_at,
      ends_at,
      status,
      pet_id,
      service_id,
      services:service_id ( name ),
      vet_user_id,
      pets:pet_id ( name ),
      notes
    `)
    .eq("client_id", input.client_id)
    .eq("clinic_id", ctx.clinicId)
    .order("starts_at", { ascending: true });

  if (input.pet_id) {
    query = query.eq("pet_id", input.pet_id);
  }

  if (input.vet_user_id) query = query.eq("vet_user_id", input.vet_user_id);
  if (input.service_id) query = query.eq("service_id", input.service_id);

  if (input.status) {
    query = query.eq("status", input.status);
  }

  if (input.upcoming_only) query = query.gte("starts_at", new Date().toISOString());
  if (input.date_from) query = query.gte("starts_at", input.date_from);
  if (input.date_to) query = query.lte("starts_at", input.date_to);

  const { data, error } = await query.limit(20);

  if (error) {
    ctx.logger("[lookup_appointments] query error", error);
    return { success: false, error: "Error al buscar citas." };
  }

  const appointments: AppointmentRow[] = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    pet_id: (row.pet_id as string | null) ?? null,
    service_id: (row.service_id as string | null) ?? null,
    vet_user_id: (row.vet_user_id as string | null) ?? null,
    starts_at: row.starts_at as string,
    ends_at: row.ends_at as string,
    status: row.status as string,
    service_name: (row.services as { name?: string })?.name ?? "Desconocido",
    vet_name: "Por determinar",
    pet_name: (row.pets as { name?: string })?.name ?? "Desconocido",
    notes: (row.notes as string | null) ?? null,
  }));

  if (appointments.length === 0) {
    return {
      success: true,
      data: { appointments: [], resolution: "none" },
    };
  }

  const vetIds = [
    ...new Set(
      data?.map((r: Record<string, unknown>) => r.vet_user_id as string).filter(Boolean) ?? [],
    ),
  ];
  if (vetIds.length > 0) {
    const { data: vets } = await (
      supabase as unknown as ReturnType<typeof import("@supabase/supabase-js").createClient>
    )
      .from("users")
      .select("id, full_name")
      .in("id", vetIds);

    const vetMap = new Map(
      ((vets ?? []) as { id: string; full_name: string }[]).map((v) => [v.id, v.full_name]),
    );
    for (const appt of appointments) {
      const row = data?.find((r: Record<string, unknown>) => r.id === appt.id) as
        | Record<string, unknown>
        | undefined;
      const vetId = row?.vet_user_id as string | undefined;
      const vetName = vetId ? vetMap.get(vetId) : undefined;
      if (vetName) {
        appt.vet_name = vetName;
      }
    }
  }

  return {
    success: true,
    data: { appointments, resolution: classifyAppointmentResolution(appointments) },
  };
}

export const lookupAppointments: Tool<Input, Output> = {
  name: "lookup_appointments",
  description:
    "Busca citas de un cliente y devuelve resolution=none, unique o ambiguous. Permite filtrar por mascota, veterinario, servicio, estado, rango temporal y solo futuras. Si resolution=ambiguous, NO elijas una cita arbitrariamente: pregunta al cliente cuál quiere gestionar.",
  inputSchema,
  handler,
};
