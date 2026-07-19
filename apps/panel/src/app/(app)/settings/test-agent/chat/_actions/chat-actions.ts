"use server";

import { getAdminClinicId } from "@/app/(app)/settings/test-availability/_actions/test-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  startConversation,
  loadConversation,
  loadMessages,
  loadRecentConversations,
} from "@/lib/agent/conversation-store";
import { runAgentLoop } from "@/lib/agent/loop";
import type { ConversationRecord, MessageRecord } from "@/lib/agent/conversation-store";
import type { ToolCallRecord } from "@/lib/agent/loop";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatActionResult =
  | { success: true; data: ConversationRecord }
  | { success: false; error: string };

export type SendMessageResult = {
  success: boolean;
  /** Final agent response text. */
  response?: string;
  /** Tool calls executed during this turn. */
  toolCalls?: ToolCallRecord[];
  /** Whether the conversation was terminated (escalated). */
  terminated?: boolean;
  error?: string;
};

export type LoadConversationResult = {
  success: boolean;
  conversation?: ConversationRecord;
  messages?: MessageRecord[];
  error?: string;
};

export type LoadConversationsResult = {
  success: boolean;
  conversations?: ConversationRecord[];
  error?: string;
};

// ---------------------------------------------------------------------------
// Start a new conversation
// ---------------------------------------------------------------------------

export async function startNewConversation(
  clientPhone?: string,
): Promise<ChatActionResult> {
  const clinicIdOrError = await getAdminClinicId();
  if (typeof clinicIdOrError !== "string") {
    return { success: false, error: clinicIdOrError.error };
  }

  const supabaseAdmin = createAdminClient();

  try {
    const conversation = await startConversation(
      supabaseAdmin,
      clinicIdOrError,
      "web",
      clientPhone ?? undefined,
    );
    return { success: true, data: conversation };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Send a message and run the agent loop
// ---------------------------------------------------------------------------

export async function sendMessage(
  conversationId: string,
  message: string,
): Promise<SendMessageResult> {
  const clinicIdOrError = await getAdminClinicId();
  if (typeof clinicIdOrError !== "string") {
    return { success: false, error: clinicIdOrError.error };
  }

  const supabaseAdmin = createAdminClient();

  try {
    // Load conversation to get client_phone from metadata
    const conversation = await loadConversation(supabaseAdmin, conversationId);
    if (!conversation) {
      return { success: false, error: "Conversación no encontrada." };
    }

    const clientPhone =
      (conversation.metadata as Record<string, unknown> | null)?.client_phone as
        | string
        | undefined;

    // Load previous messages
    const previousMessages = await loadMessages(supabaseAdmin, conversationId);

    // Run the agent loop
    const result = await runAgentLoop({
      conversationId,
      clinicId: clinicIdOrError,
      userMessage: message,
      previousMessages,
      clientPhone,
      supabaseAdmin,
    });

    return {
      success: true,
      response: result.response,
      toolCalls: result.toolCalls,
      terminated: result.terminated,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error desconocido";
    console.error("[sendMessage] error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ---------------------------------------------------------------------------
// Load a conversation with messages
// ---------------------------------------------------------------------------

export async function loadConversationWithMessages(
  conversationId: string,
): Promise<LoadConversationResult> {
  const clinicIdOrError = await getAdminClinicId();
  if (typeof clinicIdOrError !== "string") {
    return { success: false, error: clinicIdOrError.error };
  }

  const supabaseAdmin = createAdminClient();

  try {
    const conversation = await loadConversation(supabaseAdmin, conversationId);
    if (!conversation) {
      return { success: false, error: "Conversación no encontrada." };
    }

    const messages = await loadMessages(supabaseAdmin, conversationId);

    return {
      success: true,
      conversation,
      messages,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Load recent conversations list
// ---------------------------------------------------------------------------

export async function loadRecentConversationsList(): Promise<LoadConversationsResult> {
  const clinicIdOrError = await getAdminClinicId();
  if (typeof clinicIdOrError !== "string") {
    return { success: false, error: clinicIdOrError.error };
  }

  const supabaseAdmin = createAdminClient();

  try {
    const conversations = await loadRecentConversations(
      supabaseAdmin,
      clinicIdOrError,
      50,
    );
    return { success: true, conversations };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: message };
  }
}
