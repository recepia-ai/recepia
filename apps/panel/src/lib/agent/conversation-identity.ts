import type { Database } from "@recepia/db";
import type { SupabaseClient } from "@supabase/supabase-js";

type AdminClient = SupabaseClient<Database>;

type IdentityInput = {
  conversationId: string | null;
  clinicId: string;
  clientId: string;
  petId?: string | null;
};

/**
 * Keep the conversation identity in sync with the records learned or created
 * by the agent. The inbox, conversation detail and client history all read
 * these foreign keys, so persisting data only in clients/pets is not enough.
 */
export async function linkConversationIdentity(
  supabaseAdmin: AdminClient,
  input: IdentityInput,
): Promise<{ success: true } | { success: false; error: string }> {
  if (!input.conversationId) return { success: true };

  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("id", input.clientId)
    .eq("clinic_id", input.clinicId)
    .is("deleted_at", null)
    .maybeSingle();

  if (clientError || !client) {
    return { success: false, error: "El cliente no pertenece a la clínica." };
  }

  if (input.petId) {
    const { data: pet, error: petError } = await supabaseAdmin
      .from("pets")
      .select("id")
      .eq("id", input.petId)
      .eq("client_id", input.clientId)
      .eq("clinic_id", input.clinicId)
      .eq("active", true)
      .is("deleted_at", null)
      .maybeSingle();

    if (petError || !pet) {
      return { success: false, error: "La mascota no pertenece al cliente de la clínica." };
    }
  }

  const update: Database["public"]["Tables"]["conversations"]["Update"] = {
    client_id: input.clientId,
  };
  if (input.petId !== undefined) update.pet_id = input.petId;

  const { data: conversation, error } = await supabaseAdmin
    .from("conversations")
    .update(update)
    .eq("id", input.conversationId)
    .eq("clinic_id", input.clinicId)
    .select("id")
    .maybeSingle();

  if (error || !conversation) {
    return { success: false, error: "No se pudo enlazar la conversación con el cliente." };
  }

  return { success: true };
}
