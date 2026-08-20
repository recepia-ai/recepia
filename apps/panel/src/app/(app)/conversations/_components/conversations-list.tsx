"use client";

import type { Database } from "@recepia/db";
import { Globe2, History, MessageCircle, Phone, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/app/(app)/_components/status-badge";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ChannelBadge } from "./channel-badge";
import { relativeTime } from "./relative-time";

type ConversationRow = {
  id: string;
  client_name: string | null;
  client_phone: string | null;
  pet_name: string | null;
  status: Database["public"]["Enums"]["conversation_status"];
  category: Database["public"]["Enums"]["conversation_category"] | null;
  urgency_level: Database["public"]["Enums"]["urgency_level"] | null;
  channel: Database["public"]["Enums"]["channel_type"];
  message_count: number;
  call_count: number;
  last_call_duration_seconds: number | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  started_at: string;
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

type Props = {
  conversations: ConversationRow[];
  clinicName: string;
  clinicId: string | null;
};

type StatusFilter = "all" | "open" | "waiting" | "closed";
type ChannelFilter = "all" | "whatsapp" | "phone" | "web";

const OPEN_STATUSES = new Set(["active", "human_handling"]);
const CLOSED_STATUSES = new Set(["completed", "transferred", "abandoned"]);

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function ConversationsList({ conversations, clinicName, clinicId }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<Set<string> | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");

  useEffect(() => {
    if (!clinicId) return;

    const supabase = createClient();
    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 250);
    };

    const channel = supabase
      .channel(`conversation-inbox:${clinicId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `clinic_id=eq.${clinicId}`,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `clinic_id=eq.${clinicId}` },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_sessions",
          filter: `clinic_id=eq.${clinicId}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [clinicId, router]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!clinicId || normalizedQuery.length < 2) {
      setSearchMatches(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("search_conversation_ids", {
        p_clinic_id: clinicId,
        p_query: normalizedQuery,
        p_limit: 200,
      });

      if (cancelled) return;
      if (error) {
        console.error("[conversations] search failed:", error.message);
        setSearchMatches(null);
        return;
      }

      setSearchMatches(new Set((data ?? []).map((row) => row.conversation_id)));
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [clinicId, query]);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");

    return conversations.filter((conversation) => {
      if (channelFilter !== "all" && conversation.channel !== channelFilter) {
        return false;
      }

      if (statusFilter === "open" && !OPEN_STATUSES.has(conversation.status)) {
        return false;
      }
      if (statusFilter === "waiting" && conversation.status !== "awaiting_human") {
        return false;
      }
      if (statusFilter === "closed" && !CLOSED_STATUSES.has(conversation.status)) {
        return false;
      }

      if (!normalizedQuery) return true;

      if (searchMatches) return searchMatches.has(conversation.id);

      return [
        conversation.client_name,
        conversation.client_phone,
        conversation.pet_name,
        conversation.last_message_preview,
      ].some((value) => value?.toLocaleLowerCase("es").includes(normalizedQuery));
    });
  }, [channelFilter, conversations, query, searchMatches, statusFilter]);

  const channelCounts = useMemo(
    () => ({
      all: conversations.length,
      whatsapp: conversations.filter((conversation) => conversation.channel === "whatsapp").length,
      phone: conversations.filter((conversation) => conversation.channel === "phone").length,
      web: conversations.filter((conversation) => conversation.channel === "web").length,
    }),
    [conversations],
  );

  const showListOnMobile = !pathname.startsWith("/conversations/") || pathname === "/conversations";

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col border-r border-stone-200 bg-white lg:w-[380px] lg:shrink-0",
        !showListOnMobile && "hidden lg:flex",
      )}
    >
      {/* Header */}
      <div className="shrink-0 space-y-3 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-stone-900">
              Conversaciones
            </h2>
            <p className="text-xs text-stone-500">
              {filteredConversations.length}{" "}
              {filteredConversations.length === 1 ? "resultado" : "resultados"} en {clinicName}
            </p>
          </div>
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-400"
          >
            <Plus className="size-3.5" strokeWidth={1.75} />
            Nueva
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-stone-400"
              strokeWidth={1.75}
            />
            <Input
              placeholder="Buscar..."
              className="h-8 pl-8 text-xs"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center rounded-lg border border-stone-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-medium",
              statusFilter === "all" ? "bg-stone-100 text-stone-700" : "text-stone-500",
            )}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("open")}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-medium",
              statusFilter === "open" ? "bg-stone-100 text-stone-700" : "text-stone-500",
            )}
          >
            Activas
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("waiting")}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-medium",
              statusFilter === "waiting" ? "bg-stone-100 text-stone-700" : "text-stone-500",
            )}
          >
            Esperando
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("closed")}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-medium",
              statusFilter === "closed" ? "bg-stone-100 text-stone-700" : "text-stone-500",
            )}
          >
            Histórico
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-stone-100 p-1">
          {(
            [
              ["all", "Todos", History],
              ["whatsapp", "WhatsApp", MessageCircle],
              ["phone", "Llamadas", Phone],
              ["web", "Web", Globe2],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => setChannelFilter(value)}
              aria-pressed={channelFilter === value}
              className={cn(
                "inline-flex min-w-0 flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[10px] font-medium transition-colors",
                channelFilter === value
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-stone-500 hover:bg-white/60",
              )}
            >
              <span className="inline-flex items-center gap-1">
                <Icon className="size-3" strokeWidth={1.75} />
                <span className="truncate">{label}</span>
              </span>
              <span className="text-[10px] tabular-nums text-stone-400">
                {channelCounts[value]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <p className="text-sm text-stone-500">No hay conversaciones</p>
            <p className="mt-1 text-xs text-stone-400">
              Ajusta la búsqueda o los filtros para ver otros resultados
            </p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const href = `/conversations/${conv.id}`;
            const isActive = pathname === href;
            const displayName = conv.client_name ?? conv.client_phone ?? "Sin nombre";

            return (
              <Link
                key={conv.id}
                href={href}
                prefetch={true}
                className={cn(
                  "block border-b border-stone-100 px-4 py-3 transition-colors",
                  isActive
                    ? "border-l-2 border-emerald-500 bg-emerald-50/50 pl-[14px]"
                    : "border-l-2 border-transparent hover:bg-stone-50",
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-medium text-emerald-700">
                    {initials(displayName)}
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Top row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-stone-900">
                          {displayName}
                        </span>
                        {conv.pet_name && (
                          <>
                            <span className="text-stone-300">·</span>
                            <span className="truncate text-xs text-stone-500">{conv.pet_name}</span>
                          </>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] tabular-nums text-stone-400">
                        {conv.last_message_at ? relativeTime(conv.last_message_at) : ""}
                      </span>
                    </div>

                    {/* Bottom row */}
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge status={conv.status} />
                      <ChannelBadge channel={conv.channel} />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-stone-400">
                        {conv.last_message_preview ??
                          (conv.channel === "phone" && conv.call_count > 0
                            ? `Llamada${conv.last_call_duration_seconds !== null ? ` · ${formatDuration(conv.last_call_duration_seconds)}` : ""}`
                            : conv.message_count > 0
                              ? `${conv.message_count} mensajes`
                              : "Sin mensajes")}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
