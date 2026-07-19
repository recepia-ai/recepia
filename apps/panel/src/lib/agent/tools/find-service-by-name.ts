import { z } from "zod";
import type { Tool, ToolResult, ToolContext } from "./types";

// ---------------------------------------------------------------------------
// find_service_by_name
// ---------------------------------------------------------------------------

const inputSchema = z.object({
  name: z.string().trim().min(1).describe(
    "Nombre o descripcion del servicio buscado, ej. 'revision cachorro', 'vacuna', 'ecografia'",
  ),
});

type Input = z.infer<typeof inputSchema>;

type ServiceMatch = {
  id: string;
  name: string;
  duration_minutes: number;
  price_min_cents: number | null;
  price_max_cents: number | null;
  is_surgery: boolean;
  requires_fasting: boolean;
};

type ServiceSuggestion = {
  id: string;
  name: string;
};

type Output =
  | {
      found: true;
      service: ServiceMatch;
    }
  | {
      found: false;
      suggestions: ServiceSuggestion[];
      message: string;
    };

async function handler(
  input: Input,
  ctx: ToolContext,
): Promise<ToolResult<Output>> {
  const { data, error } = await ctx.supabaseAdmin
    .from("services")
    .select(
      "id, name, duration_minutes, price_min_cents, price_max_cents, is_surgery, requires_fasting",
    )
    .eq("clinic_id", ctx.clinicId)
    .ilike("name", `%${input.name}%`)
    .order("name")
    .limit(6);

  if (error) {
    ctx.logger("[find_service_by_name] query error", error);
    return { success: false, error: "Error al buscar servicios." };
  }

  if (!data || data.length === 0) {
    return {
      success: true,
      data: {
        found: false,
        suggestions: [],
        message: "No hay ningun servicio con ese nombre en el catalogo.",
      },
    };
  }

  const rows = data as unknown as ServiceMatch[];

  // Exact case-insensitive match for single result
  if (rows.length === 1) {
    const first = rows[0]!;
    if (first.name.toLowerCase() === input.name.toLowerCase()) {
      return { success: true, data: { found: true, service: first } };
    }
  }

  // Multiple results — return suggestions (max 5)
  const suggestions: ServiceSuggestion[] = rows.slice(0, 5).map((r) => ({
    id: r.id,
    name: r.name,
  }));

  return {
    success: true,
    data: {
      found: false,
      suggestions,
      message: "Encontre varios servicios similares, ¿cual buscas?",
    },
  };
}

export const findServiceByName: Tool<Input, Output> = {
  name: "find_service_by_name",
  description:
    "Busca un servicio del catalogo de la clinica por nombre. " +
    "Devuelve el service_id, nombre exacto, duracion y precio si existe. " +
    "Usalo SIEMPRE antes de check_availability para obtener el service_id " +
    "correcto — NUNCA inventes UUIDs. Si el servicio no existe con ese " +
    "nombre, devuelve una lista de sugerencias similares.",
  inputSchema,
  handler,
};
