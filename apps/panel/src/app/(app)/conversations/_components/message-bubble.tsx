import type { Database } from "@recepia/db";
import { Sparkles } from "lucide-react";

type SenderType = Database["public"]["Enums"]["message_sender"];

type Props = {
  content: string | null;
  sender: SenderType;
  createdAt: string;
};

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageBubble({ content, sender, createdAt }: Props) {
  // System events render centered and muted.
  if (sender === "system") {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs text-stone-400">
          {content ?? "—"}
        </span>
      </div>
    );
  }

  const isClient = sender === "client";
  const isHuman = sender === "human";

  return (
    <div className={`flex ${isClient ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
          isClient
            ? "rounded-tl-md bg-stone-100"
            : isHuman
              ? "rounded-tr-md border-l-2 border-emerald-500 bg-white"
              : "rounded-tr-md bg-emerald-50"
        }`}
      >
        <p className="whitespace-pre-wrap text-sm text-stone-900">
          {content ?? "—"}
        </p>
        <p className="mt-1 flex items-center gap-1 text-[10px] text-stone-400">
          {formatTime(createdAt)}
          {!isClient && !isHuman && (
            <Sparkles className="size-2.5 text-emerald-500" />
          )}
        </p>
      </div>
    </div>
  );
}
