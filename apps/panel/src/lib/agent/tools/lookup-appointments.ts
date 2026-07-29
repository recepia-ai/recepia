import { z } from "zod";
import { uuidSchema } from "@/lib/uuid-schema";
import type { Tool, ToolResult, ToolContext } from "./types";

const inputSchema = z.object({
  client_id: uuidSchema.describe("ID del cliente cuyas citas buscar"),
  pet_id: uuidSchema.optional().describe("Opcional: filtrar solo citas de esa mascota"),
  status: z.enum(["confirmed", "completed", "cancelled"]).optional().describe("Filtrar por estado"),
});

type Input = z.infer<typeof inputSchema>;

type AppointmentRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  service_name: string;
  vet_name: string;
  pet_name: string;
};

type Output = {
  appointments: AppointmentRow[];
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
      services:service_id ( name ),
      vet_user_id,
      pets:pet_id ( name )
    `)
    .eq("client_id", input.client_id)
    .eq("clinic_id", ctx.clinicId)
    .order("starts_at", { ascending: false });

  if (input.pet_id) {
    query = query.eq("pet_id", input.pet_id);
  }

  if (input.status) {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query.limit(20);

  if (error) {
    ctx.logger("[lookup_appointments] query error", error);
    return { success: false, error: "Error al buscar citas." };
  }

  const appointments: AppointmentRow[] = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    starts_at: row.starts_at as string,
    ends_at: row.ends_at as string,
    status: row.status as string,
    service_name: (row.services as { name?: string })?.name ?? "Desconocido",
    vet_name: "Por determinar",
    pet_name: (row.pets as { name?: string })?.name ?? "Desconocido",
  }));

  if (appointments.length === 0) {
    return {
      success: true,
      data: { appointments: [] },
    };
  }

  const vetIds = [...new Set(data?.map((r: Record<string, unknown>) => r.vet_user_id as string).filter(Boolean) ?? [])];
  if (vetIds.length > 0) {
    const { data: vets } = await supabase
      .from("users")
      .select("id, full_name")
      .in("id", vetIds);

    const vetMap = new Map((vets ?? []).map((v) => [v.id, v.full_name]));
    for (const appt of appointments) {
      const row = data?.find((r: Record<string, unknown>) => r.id === appt.id) as Record<string, unknown> | undefined;
      const vetId = row?.vet_user_id as string | undefined;
      if (vetId && vetMap.has(vetId)) {
        appt.vet_name = vetMap.get(vetId)!;
      }
    }
  }

  return {
    success: true,
    data: { appointments },
  };
}

export const lookupAppointments: Tool<Input, Output> = {
  name: "lookup_appointments",
  description:
    "Busca citas de un cliente (por client_id). Opcionalmente filtra por pet_id (mascota) y/o status (scheduled, completed, cancelled). Devuelve hasta 20 citas ordenadas por fecha descendente.",
  inputSchema,
  handler,
};
