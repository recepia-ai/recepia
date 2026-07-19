import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@recepia/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConversationRecord = {
  id: string;
  clinic_id: string;
  client_id: string | null;
  pet_id: string | null;
  channel: string;
  status: string;
  category: string | null;
  urgency_level: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type MessageRecord = {
  id: string;
  conversation_id: string;
  clinic_id: string;
  direction: "inbound" | "outbound";
  sender: "client" | "agent" | "human" | "system";
  content: string | null;
  content_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type SaveMessageParams = {
  conversationId: string;
  clinicId: string;
  direction: "inbound" | "outbound";
  sender: "client" | "agent" | "human" | "system";
  content: string | null;
  contentType?: string;
  metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

/**
 * Start a new conversation.
 *
 * client_id is left NULL — the agent fills it in once the client is identified.
 * client_phone is stored in metadata for the agent to use with lookup_client.
 *
 * TODO (E3+1): sender_user_id. Temporalmente no seteamos sender_user_id para
 * mensajes en el test panel. Cuando llegue WhatsApp real, los mensajes de
 * cliente tendran sender='client' y sender_user_id=NULL, mientras que los
 * mensajes de humano en el panel tendran sender='human' y
 * sender_user_id=auth.uid().
 */
export async function startConversation(
  supabaseAdmin: SupabaseClient<Database>,
  clinicId: string,
  channel: string = "web",
  clientPhone?: string,
): Promise<ConversationRecord> {
  const metadata: Record<string, unknown> = {};
  if (clientPhone) {
    metadata.client_phone = clientPhone;
  }

  const { data, error } = await supabaseAdmin
    .from("conversations")
    .insert({
      clinic_id: clinicId,
      channel: channel as unknown as "web",
      status: "active",
      metadata: metadata as unknown as Record<string, never>,
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to start conversation: ${error.message}`);
  return data as unknown as ConversationRecord;
}

export async function endConversation(
  supabaseAdmin: SupabaseClient<Database>,
  conversationId: string,
  status: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("conversations")
    .update({
      status: status as unknown as "transferred",
      ended_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  if (error) throw new Error(`Failed to end conversation: ${error.message}`);
}

export async function loadRecentConversations(
  supabaseAdmin: SupabaseClient<Database>,
  clinicId: string,
  limit: number = 50,
): Promise<ConversationRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load conversations: ${error.message}`);
  return (data ?? []) as unknown as ConversationRecord[];
}

export async function loadConversation(
  supabaseAdmin: SupabaseClient<Database>,
  conversationId: string,
): Promise<ConversationRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load conversation: ${error.message}`);
  return (data as unknown as ConversationRecord) ?? null;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/**
 * Save a message to the messages table.
 *
 * Uses the admin client (service_role) to bypass RLS. The messages_human_insert
 * policy only allows sender='human', which blocks agent/system/client messages
 * from the regular supabase client.
 *
 * TODO (E3+1): sender_user_id. Temporalmente usamos el admin logueado como
 * sender_user_id para mensajes del cliente en test panel. Cuando venga
 * WhatsApp real, sender_user_id sera NULL y sender='client' es lo que
 * identifica origen.
 */
export async function saveMessage(
  supabaseAdmin: SupabaseClient<Database>,
  params: SaveMessageParams,
): Promise<MessageRecord> {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: params.conversationId,
      clinic_id: params.clinicId,
      direction: params.direction as unknown as "inbound" | "outbound",
      sender: params.sender as unknown as "client" | "agent" | "human" | "system",
      content: params.content,
      content_type:
        (params.contentType as unknown as "text") ?? "text",
      metadata: (params.metadata as unknown as Record<string, never>) ?? {},
    })
    .select("*")
    .single();

  if (error) throw new Error(`Failed to save message: ${error.message}`);
  return data as unknown as MessageRecord;
}

export async function loadMessages(
  supabaseAdmin: SupabaseClient<Database>,
  conversationId: string,
): Promise<MessageRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load messages: ${error.message}`);
  return (data ?? []) as unknown as MessageRecord[];
}
