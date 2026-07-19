"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, User, Bot, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MessageRecord } from "@/lib/agent/conversation-store";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type MessageBubbleProps = {
  message: MessageRecord;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageBubble({ message }: MessageBubbleProps) {
  const isClient = message.sender === "client";
  const isAgent = message.sender === "agent";
  const isSystem = message.sender === "system";

  // System messages (tool calls/results) — collapsible debug entries
  if (isSystem) {
    return <SystemMessageRow message={message} />;
  }

  return (
    <div
      className={cn(
        "flex gap-2 mb-3",
        isClient ? "justify-start" : "justify-end",
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full mt-0.5",
          isClient
            ? "order-first bg-stone-100 text-stone-500"
            : "order-last bg-emerald-100 text-emerald-600",
        )}
      >
        {isClient ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[75%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
          isClient
            ? "bg-stone-100 text-stone-800"
            : "bg-emerald-50 text-stone-800 border border-emerald-100",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p className="mt-1 text-[10px] text-stone-400">
          {formatTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// System message row (tool calls / tool results)
// ---------------------------------------------------------------------------

function SystemMessageRow({ message }: MessageBubbleProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = message.metadata as Record<string, unknown> | null;
  const isToolCall = meta?.tool_uses != null;
  const isToolResult = meta?.tool_result != null;

  const label = isToolCall
    ? `Tool call: ${(meta!.tool_uses as Array<{ name: string }>).map((t) => t.name).join(", ")}`
    : isToolResult
      ? `Tool result: ${(meta!.tool_result as { name: string }).name}`
      : message.content ?? "System event";

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-left text-[11px] transition-colors",
          "bg-amber-50 text-amber-700 hover:bg-amber-100",
          "border border-amber-100",
        )}
      >
        <Wrench className="size-3 shrink-0" />
        <span className="flex-1 truncate font-medium">{label}</span>
        <span className="text-[10px] text-amber-400">
          {formatTime(message.created_at)}
        </span>
        {expanded ? (
          <ChevronDown className="size-3 shrink-0" />
        ) : (
          <ChevronRight className="size-3 shrink-0" />
        )}
      </button>

      {expanded && (
        <pre className="mt-1 rounded-lg border border-amber-100 bg-amber-50/50 p-3 text-[10px] text-stone-600 overflow-x-auto whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
          {JSON.stringify(
            isToolCall ? meta?.tool_uses : isToolResult ? meta?.tool_result : meta,
            null,
            2,
          )}
        </pre>
      )}
    </div>
  );
}
