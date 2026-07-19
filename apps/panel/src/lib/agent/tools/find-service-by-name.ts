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

type ServiceRow = {
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
      service: ServiceRow;
    }
  | {
      found: false;
      suggestions: ServiceSuggestion[];
      message: string;
    };

// Normalize text for accent-insensitive search:
// - Decomposes accented chars (NFD)
// - Strips diacritical marks
// - Lowercases
// - Trims whitespace
function normalizeForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

async function handler(
  input: Input,
  ctx: ToolContext,
): Promise<ToolResult<Output>> {
  // Fetch ALL services for this clinic — small dataset (~40 rows max).
  // Filtering is done in TS with accent-insensitive normalization.
  const { data, error } = await ctx.supabaseAdmin
    .from("services")
    .select(
      "id, name, duration_minutes, price_min_cents, price_max_cents, is_surgery, requires_fasting",
    )
    .eq("clinic_id", ctx.clinicId)
    .order("name");

  if (error) {
    ctx.logger("[find_service_by_name] query error", error);
    return { success: false, error: "Error al buscar servicios." };
  }

  const allServices = (data ?? []) as unknown as ServiceRow[];
  const normalizedQuery = normalizeForSearch(input.name);

  if (!normalizedQuery) {
    return {
      success: true,
      data: {
        found: false,
        suggestions: [],
        message: "No hay ningun servicio con ese nombre en el catalogo.",
      },
    };
  }

  const matches = allServices.filter((s) =>
    normalizeForSearch(s.name).includes(normalizedQuery),
  );

  // Exactly 1 match (partial or exact) → found: true.
  // This is what fixes bug: previously "cachorro" returned 1 suggestion as found:false.
  if (matches.length === 1) {
    return {
      success: true,
      data: { found: true, service: matches[0]! },
    };
  }

  if (matches.length === 0) {
    return {
      success: true,
      data: {
        found: false,
        suggestions: [],
        message: "No hay ningun servicio con ese nombre en el catalogo.",
      },
    };
  }

  // Multiple matches — return top 5 suggestions.
  const suggestions: ServiceSuggestion[] = matches.slice(0, 5).map((r) => ({
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
