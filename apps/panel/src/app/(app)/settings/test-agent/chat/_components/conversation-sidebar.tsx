"use client";

import { useState } from "react";
import { Plus, MessageSquare, Phone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ConversationRecord } from "@/lib/agent/conversation-store";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ConversationSidebarProps = {
  conversations: ConversationRecord[];
  activeId: string | null;
  isCreating: boolean;
  onSelect: (id: string) => void;
  onNew: (clientPhone?: string) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Ahora";
    if (diffMins < 60) return `Hace ${diffMins}m`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;

    return d.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Activa";
    case "awaiting_human":
      return "Esperando";
    case "transferred":
      return "Transferida";
    case "resolved":
      return "Resuelta";
    case "abandoned":
      return "Abandonada";
    default:
      return status;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-700";
    case "awaiting_human":
      return "bg-amber-100 text-amber-700";
    case "transferred":
      return "bg-blue-100 text-blue-700";
    case "resolved":
      return "bg-stone-100 text-stone-600";
    case "abandoned":
      return "bg-stone-100 text-stone-400";
    default:
      return "bg-stone-100 text-stone-600";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConversationSidebar({
  conversations,
  activeId,
  isCreating,
  onSelect,
  onNew,
}: ConversationSidebarProps) {
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [phone, setPhone] = useState("+34600000200");

  function handleNewClick() {
    if (showPhoneInput) {
      // Create with phone
      const trimmed = phone.trim();
      onNew(trimmed || undefined);
      setShowPhoneInput(false);
    } else {
      setShowPhoneInput(true);
    }
  }

  function handleQuickNew() {
    // Create without phone
    onNew(undefined);
    setShowPhoneInput(false);
  }

  return (
    <div className="flex h-full flex-col border-r border-stone-200 bg-stone-50/50">
      {/* Header */}
      <div className="border-b border-stone-200 px-3 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <Button
            onClick={handleNewClick}
            disabled={isCreating}
            variant="default"
            size="sm"
            className="flex-1"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                Creando…
              </>
            ) : (
              <>
                <Plus className="mr-1.5 size-3.5" />
                Nueva conversación
              </>
            )}
          </Button>
        </div>

        {/* Phone input (collapsible) */}
        {showPhoneInput && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Phone className="size-3 text-stone-400 shrink-0" />
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+34600000000"
                className="flex-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-xs font-mono focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleNewClick();
                  if (e.key === "Escape") setShowPhoneInput(false);
                }}
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={handleQuickNew}
              className="text-[10px] text-stone-400 hover:text-stone-600 underline"
            >
              Crear sin teléfono
            </button>
          </div>
        )}
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <MessageSquare className="mx-auto size-5 text-stone-300" strokeWidth={1.5} />
            <p className="mt-2 text-xs text-stone-400">
              No hay conversaciones aún.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => onSelect(conv.id)}
                className={cn(
                  "w-full px-3 py-3 text-left transition-colors",
                  "hover:bg-stone-100",
                  activeId === conv.id && "bg-white ring-1 ring-inset ring-emerald-200",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-stone-700 truncate">
                        {(conv.metadata as Record<string, unknown> | null)
                          ?.client_phone != null
                          ? `📱 ${(conv.metadata as Record<string, unknown>).client_phone as string}`
                          : "Sin teléfono"}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                          statusColor(conv.status),
                        )}
                      >
                        {statusLabel(conv.status)}
                      </span>
                      <span className="text-[9px] text-stone-400">
                        {formatDate(conv.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
