"use client";

import { Send, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendMessage } from "./conversation-actions";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  conversationId: string;
  clientName: string;
  status: string;
  channel: "web" | "whatsapp" | "phone";
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageInputBar({ conversationId, clientName, status, channel }: Props) {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isActive = status === "active";
  const isHumanHandling = status === "human_handling";

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  });

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("conversation_id", conversationId);
      formData.set("content", trimmed);

      const result = await sendMessage({}, formData);
      if (result.success) {
        setContent("");
      } else if (result.error) {
        toast.error(result.error);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = content.trim().length > 0 && isHumanHandling && !busy;

  if (channel === "phone") {
    return (
      <div className="shrink-0 border-t border-stone-200 bg-sky-50 px-4 py-3">
        <p className="text-center text-xs text-sky-700">
          Las llamadas se atienden por voz. Cuando el agente necesite ayuda, transferirá la llamada
          a una persona del equipo.
        </p>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-stone-200 bg-white px-4 py-3">
      {/* Active: agent is responding */}
      {isActive && (
        <div className="flex items-center gap-2 rounded-lg bg-stone-50 px-4 py-2.5">
          <Sparkles className="size-4 shrink-0 text-emerald-500" strokeWidth={1.75} />
          <p className="text-sm text-stone-400">El agente está respondiendo a {clientName}…</p>
        </div>
      )}

      {/* Human handling: active input */}
      {isHumanHandling && (
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Escribe a ${clientName}…`}
            disabled={busy}
            rows={1}
            className="min-h-[40px] max-h-[160px] w-full resize-none rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-200 disabled:opacity-50"
          />
          <Button
            size="icon"
            variant={canSend ? "default" : "ghost"}
            disabled={!canSend}
            onClick={handleSend}
            className="mb-0.5 shrink-0"
          >
            <Send className="size-4" strokeWidth={1.75} />
          </Button>
        </div>
      )}

      {/* Resolved or abandoned: no input */}
      {!isActive && !isHumanHandling && (
        <p className="text-center text-xs text-stone-400">
          {status === "awaiting_human"
            ? "Esta conversación espera que una persona del equipo tome el control."
            : "Esta conversación ha finalizado."}
        </p>
      )}
    </div>
  );
}
