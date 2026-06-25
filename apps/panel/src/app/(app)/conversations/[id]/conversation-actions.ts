"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  sendMessageSchema,
  type SendMessageState,
  takeControlSchema,
  type TakeControlState,
  returnToAgentSchema,
  type ReturnToAgentState,
} from "./conversation-schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ClinicUserRow = { clinic_id: string; role: string };

// ---------------------------------------------------------------------------
// takeControl — sets status to human_handling
// ---------------------------------------------------------------------------

export async function takeControl(
  _prevState: TakeControlState,
  formData: FormData,
): Promise<TakeControlState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const parsed = takeControlSchema.safeParse({
    conversation_id: formData.get("conversation_id"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { conversation_id } = parsed.data;

  // Verify user belongs to the conversation's clinic
  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinic_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  const cu = clinicUser as ClinicUserRow | null;
  if (!cu) return { error: "Sin clínica asignada" };

  const { data: convGuard } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversation_id)
    .eq("clinic_id", cu.clinic_id)
    .maybeSingle();

  if (!convGuard) return { error: "Conversación no encontrada" };

  // TODO(E3): when controlled_by and controlled_at columns are added, set:
  //   controlled_by = user.id, controlled_at = now()
  // For now we only change the status.

  const query = supabase.from("conversations") as any;
  const { data: updated, error } = await query
    .update({ status: "human_handling" })
    .eq("id", conversation_id)
    .eq("clinic_id", cu.clinic_id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[takeControl]", error);
    return { error: "Error al tomar el control. Intenta de nuevo." };
  }

  if (!updated) {
    return { error: "No tienes permiso para tomar el control." };
  }

  revalidatePath(`/conversations/${conversation_id}`);
  revalidatePath("/conversations");
  return { success: true };
}

// ---------------------------------------------------------------------------
// returnToAgent — sets status back to active
// ---------------------------------------------------------------------------

export async function returnToAgent(
  _prevState: ReturnToAgentState,
  formData: FormData,
): Promise<ReturnToAgentState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const parsed = returnToAgentSchema.safeParse({
    conversation_id: formData.get("conversation_id"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { conversation_id } = parsed.data;

  // Verify user belongs to the conversation's clinic
  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinic_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  const cu = clinicUser as ClinicUserRow | null;
  if (!cu) return { error: "Sin clínica asignada" };

  const { data: convGuard } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversation_id)
    .eq("clinic_id", cu.clinic_id)
    .maybeSingle();

  if (!convGuard) return { error: "Conversación no encontrada" };

  const query = supabase.from("conversations") as any;
  const { data: updated, error } = await query
    .update({ status: "active" })
    .eq("id", conversation_id)
    .eq("clinic_id", cu.clinic_id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[returnToAgent]", error);
    return { error: "Error al devolver al agente. Intenta de nuevo." };
  }

  if (!updated) {
    return { error: "No tienes permiso para devolver al agente." };
  }

  revalidatePath(`/conversations/${conversation_id}`);
  revalidatePath("/conversations");
  return { success: true };
}

// ---------------------------------------------------------------------------
// sendMessage — inserts a human-authored message
// ---------------------------------------------------------------------------

export async function sendMessage(
  _prevState: SendMessageState,
  formData: FormData,
): Promise<SendMessageState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const parsed = sendMessageSchema.safeParse({
    conversation_id: formData.get("conversation_id"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { conversation_id, content } = parsed.data;

  // Verify user belongs to the conversation's clinic
  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinic_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  const cu = clinicUser as ClinicUserRow | null;
  if (!cu) return { error: "Sin clínica asignada" };

  const { data: convGuard } = await supabase
    .from("conversations")
    .select("id, status")
    .eq("id", conversation_id)
    .eq("clinic_id", cu.clinic_id)
    .maybeSingle();

  const cg = convGuard as { id: string; status: string } | null;
  if (!cg) return { error: "Conversación no encontrada" };

  // Only allow sending when the human is in control
  if (cg.status !== "human_handling") {
    return { error: "Toma el control primero para enviar mensajes." };
  }

  // Insert message — clinic_id is auto-populated by DB trigger
  // using `as any` because the typed Insert requires clinic_id but the
  // trigger fills it from the parent conversation.
  const { error: insertError } = await (supabase.from("messages") as any).insert(
    {
      conversation_id,
      content,
      sender: "human",
      direction: "outbound",
      content_type: "text",
      sender_user_id: user.id,
    },
  );

  if (insertError) {
    console.error("[sendMessage]", insertError);
    return { error: "Error al enviar el mensaje. Intenta de nuevo." };
  }

  revalidatePath(`/conversations/${conversation_id}`);
  revalidatePath("/conversations");
  return { success: true };
}
