"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

const recordSchema = z.object({
  pet_id: z.string().uuid(),
  record_type: z.enum(["pathology", "report", "radiograph", "analysis", "prescription", "note"]),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000),
  occurred_at: z.string().date(),
  external_url: z.union([
    z
      .string()
      .trim()
      .url()
      .refine((value) => /^https?:\/\//i.test(value), "El enlace debe usar HTTP o HTTPS"),
    z.literal(""),
  ]),
});

export async function createPetRecord(formData: FormData): Promise<{
  success?: true;
  error?: string;
}> {
  const parsed = recordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "No autenticado" };
  const { data: membership } = await supabase
    .from("clinic_users")
    .select("clinic_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!membership) return { error: "Sin clínica asignada" };

  const { data: pet } = await supabase
    .from("pets")
    .select("id")
    .eq("id", parsed.data.pet_id)
    .eq("clinic_id", membership.clinic_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!pet) return { error: "La mascota no existe" };

  const file = formData.get("file");
  let filePath: string | null = null;
  let fileName: string | null = null;
  let mimeType: string | null = null;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_FILE_SIZE) return { error: "El archivo supera el límite de 20 MB" };
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return { error: "Solo se admiten PDF, JPG, PNG o WebP" };
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || "documento";
    filePath = `${membership.clinic_id}/${pet.id}/${crypto.randomUUID()}-${safeName}`;
    const upload = await supabase.storage.from("pet-records").upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upload.error) return { error: "No se pudo subir el archivo" };
    fileName = file.name;
    mimeType = file.type;
  }

  const { error } = await supabase.from("pet_records").insert({
    clinic_id: membership.clinic_id,
    pet_id: pet.id,
    record_type: parsed.data.record_type,
    title: parsed.data.title,
    description: parsed.data.description || null,
    occurred_at: parsed.data.occurred_at,
    external_url: parsed.data.external_url || null,
    file_path: filePath,
    file_name: fileName,
    mime_type: mimeType,
    created_by_user_id: auth.user.id,
  });

  if (error) {
    if (filePath) await supabase.storage.from("pet-records").remove([filePath]);
    return { error: "No se pudo guardar la entrada del historial" };
  }

  revalidatePath(`/pets/${pet.id}`);
  revalidatePath("/pets");
  return { success: true };
}
