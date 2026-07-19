"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { Send, Loader2, AlertTriangle, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConversationSidebar } from "./_components/conversation-sidebar";
import { MessageBubble } from "./_components/message-bubble";
import type { ConversationRecord, MessageRecord } from "@/lib/agent/conversation-store";
import type { ToolCallRecord } from "@/lib/agent/loop";
import type {
  SendMessageResult,
  ChatActionResult,
  LoadConversationResult,
} from "./_actions/chat-actions";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ChatClientProps = {
  initialConversations: ConversationRecord[];
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatClient({ initialConversations }: ChatClientProps) {
  const [conversations, setConversations] = useState<ConversationRecord[]>(
    initialConversations,
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [input, setInput] = useState("");
  const [isSending, startSendTransition] = useTransition();
  const [isCreating, startCreateTransition] = useTransition();
  const [isLoading, startLoadTransition] = useTransition();
  const [debugToolCalls, setDebugToolCalls] = useState<ToolCallRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [terminated, setTerminated] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ---- Auto-scroll ----
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ---- Load conversation ----
  function handleSelectConversation(id: string) {
    setActiveId(id);
    setDebugToolCalls(null);
    setError(null);
    setTerminated(false);

    startLoadTransition(async () => {
      const { loadConversationWithMessages } = await import("./_actions/chat-actions");
      const r: LoadConversationResult = await loadConversationWithMessages(id);
      if (r.success) {
        setMessages(r.messages ?? []);
        setTerminated(
          r.conversation?.status === "transferred" ||
            r.conversation?.status === "resolved",
        );
      } else {
        setError(r.error ?? "Error al cargar conversación");
      }
    });
  }

  // ---- New conversation ----
  function handleNewConversation(clientPhone?: string) {
    startCreateTransition(async () => {
      const { startNewConversation } = await import("./_actions/chat-actions");
      const r: ChatActionResult = await startNewConversation(clientPhone);
      if (r.success) {
        setConversations((prev) => [r.data, ...prev]);
        setActiveId(r.data.id);
        setMessages([]);
        setDebugToolCalls(null);
        setError(null);
        setTerminated(false);
        setInput("");

        // Focus input after render
        setTimeout(() => inputRef.current?.focus(), 100);
      } else {
        setError(r.error);
      }
    });
  }

  // ---- Send message ----
  function handleSend() {
    const text = input.trim();
    if (!text || !activeId || isSending || terminated) return;

    setInput("");
    setError(null);
    setDebugToolCalls(null);

    // Optimistic client message
    const optimisticMsg: MessageRecord = {
      id: `optimistic-${Date.now()}`,
      conversation_id: activeId,
      clinic_id: "",
      direction: "inbound",
      sender: "client",
      content: text,
      content_type: "text",
      metadata: {},
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    startSendTransition(async () => {
      const { sendMessage } = await import("./_actions/chat-actions");
      const r: SendMessageResult = await sendMessage(activeId, text);

      // Remove optimistic message and reload
      const { loadConversationWithMessages } = await import("./_actions/chat-actions");
      const reloaded: LoadConversationResult =
        await loadConversationWithMessages(activeId);

      if (reloaded.success) {
        setMessages(reloaded.messages ?? []);
      }

      if (r.success) {
        setDebugToolCalls((r.toolCalls?.length ?? 0) > 0 ? (r.toolCalls ?? null) : null);
        if (r.terminated) {
          setTerminated(true);
          // Refresh conversations list to show updated status
          const { loadRecentConversationsList } = await import("./_actions/chat-actions");
          const list = await loadRecentConversationsList();
          if (list.success) setConversations(list.conversations ?? []);
        }
      } else {
        setError(r.error ?? "Error al enviar mensaje");
      }
    });
  }

  // ---- Keyboard ----
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ---- Active conversation info ----
  const activeConv = conversations.find((c) => c.id === activeId);
  const activePhone =
    activeConv?.metadata != null
      ? ((activeConv.metadata as Record<string, unknown>).client_phone as string | undefined)
      : undefined;

  return (
    <div className="flex h-[650px]">
      {/* Sidebar */}
      <div className="w-64 shrink-0">
        <ConversationSidebar
          conversations={conversations}
          activeId={activeId}
          isCreating={isCreating}
          onSelect={handleSelectConversation}
          onNew={handleNewConversation}
        />
      </div>

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Conversation header */}
        {activeConv && (
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-2.5 bg-white">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-medium text-stone-700 truncate">
                {activePhone ? `📱 ${activePhone}` : "Sin teléfono"}
              </span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[9px] font-medium shrink-0",
                  activeConv.status === "active"
                    ? "bg-emerald-100 text-emerald-700"
                    : activeConv.status === "transferred"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-stone-100 text-stone-600",
                )}
              >
                {activeConv.status === "active"
                  ? "Activa"
                  : activeConv.status === "transferred"
                    ? "Transferida"
                    : activeConv.status === "resolved"
                      ? "Resuelta"
                      : activeConv.status}
              </span>
              {terminated && (
                <span className="text-[10px] text-amber-600 font-medium">
                  Conversación terminada
                </span>
              )}
            </div>
          </div>
        )}

        {/* Messages area */}
        <div
          className={cn(
            "flex-1 overflow-y-auto px-4 py-4",
            !activeId && "flex items-center justify-center",
          )}
        >
          {!activeId ? (
            <div className="text-center">
              <p className="text-sm text-stone-400">
                Selecciona una conversación o crea una nueva para empezar.
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-stone-300" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-stone-400">
                Envía el primer mensaje para empezar la conversación.
              </p>
            </div>
          ) : (
            <div>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {/* Typing indicator */}
              {isSending && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <Loader2 className="size-3.5 animate-spin" />
                  </div>
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3.5 py-2.5">
                    <span className="text-xs text-emerald-600">Escribiendo…</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-600 shrink-0"
            >
              ✕
            </button>
          </div>
        )}

        {/* Debug panel: tool calls */}
        {debugToolCalls && debugToolCalls.length > 0 && (
          <div className="mx-4 mb-2 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
            <div className="flex items-center gap-1.5 border-b border-amber-200 px-4 py-1.5">
              <Wrench className="size-3 text-amber-500" />
              <span className="text-[10px] font-semibold text-amber-700">
                Tool calls ({debugToolCalls.length})
              </span>
            </div>
            <pre className="p-3 text-[10px] text-stone-600 overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
              {JSON.stringify(
                debugToolCalls.map((tc) => ({
                  tool: tc.name,
                  input: tc.input,
                  output: tc.output,
                })),
                null,
                2,
              )}
            </pre>
          </div>
        )}

        {/* Input area */}
        {activeId && (
          <div className="border-t border-stone-200 bg-white px-4 py-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  terminated
                    ? "Esta conversación ha terminado."
                    : "Escribe un mensaje… (Enter para enviar, Shift+Enter para nueva línea)"
                }
                rows={2}
                disabled={isSending || terminated}
                className={cn(
                  "flex-1 resize-none rounded-lg border bg-white px-3 py-2 text-sm",
                  "focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500",
                  terminated
                    ? "border-stone-200 bg-stone-50 text-stone-400"
                    : "border-stone-200 text-stone-700",
                )}
              />
              <Button
                onClick={handleSend}
                disabled={isSending || !input.trim() || terminated}
                variant="default"
                size="sm"
                className="mb-0.5"
              >
                {isSending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
