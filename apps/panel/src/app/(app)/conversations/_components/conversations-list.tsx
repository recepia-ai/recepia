"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/app/(app)/_components/status-badge";
import { relativeTime } from "./relative-time";
import { Plus, Search } from "lucide-react";
import type { Database } from "@recepia/db";

type ConversationRow = {
  id: string;
  client_name: string | null;
  client_phone: string | null;
  pet_name: string | null;
  status: Database["public"]["Enums"]["conversation_status"];
  category: Database["public"]["Enums"]["conversation_category"] | null;
  message_count: number;
  last_message_at: string | null;
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

type Props = {
  conversations: ConversationRow[];
  clinicName: string;
};

export function ConversationsList({ conversations, clinicName }: Props) {
  const pathname = usePathname();

  const showListOnMobile =
    !pathname.startsWith("/conversations/") || pathname === "/conversations";

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
              {conversations.length}{" "}
              {conversations.length === 1 ? "activa" : "activas"} en {clinicName}
            </p>
          </div>
          <button
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
              disabled
            />
          </div>
        </div>
        <div className="flex items-center rounded-lg border border-stone-200 bg-white p-0.5">
          <button className="rounded-md bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-700">
            Todas
          </button>
          <button
            className="rounded-md px-2.5 py-1 text-[11px] font-medium text-stone-500"
            disabled
          >
            Activas
          </button>
          <button
            className="rounded-md px-2.5 py-1 text-[11px] font-medium text-stone-500"
            disabled
          >
            Esperando
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <p className="text-sm text-stone-500">No hay conversaciones</p>
            <p className="mt-1 text-xs text-stone-400">
              Las conversaciones de WhatsApp aparecerán aquí
            </p>
          </div>
        ) : (
          conversations.map((conv) => {
            const href = `/conversations/${conv.id}`;
            const isActive = pathname === href;
            const displayName =
              conv.client_name ?? conv.client_phone ?? "Sin nombre";

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
                            <span className="truncate text-xs text-stone-500">
                              {conv.pet_name}
                            </span>
                          </>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] tabular-nums text-stone-400">
                        {conv.last_message_at
                          ? relativeTime(conv.last_message_at)
                          : ""}
                      </span>
                    </div>

                    {/* Bottom row */}
                    <div className="mt-1 flex items-center gap-2">
                      <StatusBadge status={conv.status} />
                      <span className="truncate text-xs text-stone-400">
                        {conv.message_count > 0
                          ? `${conv.message_count} mensajes`
                          : "Sin mensajes"}
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
