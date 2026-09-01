import type { Database } from "@recepia/db";
import type { SupabaseClient } from "@supabase/supabase-js";

type AdminClient = SupabaseClient<Database>;

export function normalizeIdentityPhone(value: string): string | null {
  const trimmed = value.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 9) digits = `34${digits}`;
  if (digits.length < 7 || digits.length > 15 || digits.startsWith("0")) return null;
  return `+${digits}`;
}

export function normalizeDocumentId(value: string): string | null {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized.length >= 5 && normalized.length <= 20 ? normalized : null;
}

export async function findClientByIdentity(
  supabaseAdmin: AdminClient,
  clinicId: string,
  identity: { phone?: string | null; documentId?: string | null },
): Promise<{ id: string; name: string; phone: string; document_id: string | null } | null> {
  const phone = identity.phone ? normalizeIdentityPhone(identity.phone) : null;
  if (phone) {
    const { data } = await supabaseAdmin
      .from("clients")
      .select("id, name, phone, document_id")
      .eq("clinic_id", clinicId)
      .eq("phone", phone)
      .is("deleted_at", null)
      .maybeSingle();
    if (data) return data;
  }

  const documentId = identity.documentId ? normalizeDocumentId(identity.documentId) : null;
  if (!documentId) return null;
  const { data } = await supabaseAdmin
    .from("clients")
    .select("id, name, phone, document_id")
    .eq("clinic_id", clinicId)
    .eq("document_id", documentId)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}
