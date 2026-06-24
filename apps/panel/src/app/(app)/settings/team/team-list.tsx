"use client";

import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TeamMember = {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  recepcion: "Recepción",
  veterinario: "Veterinario",
};

const ROLE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  admin: "default",
  recepcion: "secondary",
  veterinario: "outline",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initialsFrom(member: TeamMember): string {
  if (member.display_name) {
    const parts = member.display_name.trim().split(/\s+/);
    const first = parts[0];
    const last = parts[parts.length - 1];
    if (parts.length >= 2 && first && last) {
      return (first.charAt(0) + last.charAt(0)).toUpperCase();
    }
    return member.display_name.slice(0, 2).toUpperCase();
  }
  if (member.email) return member.email.slice(0, 2).toUpperCase();
  return "??";
}

function displayLabel(member: TeamMember, currentUserId: string): string {
  if (member.display_name) return member.display_name;
  if (member.email) return member.email;
  return member.user_id.slice(0, 8) + "…";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  members: TeamMember[];
  currentUserId: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TeamList({ members, currentUserId }: Props) {
  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-stone-50 px-6 py-12 text-center">
        <Users className="mx-auto size-5 text-stone-300" strokeWidth={1.75} />
        <p className="mt-2 text-sm text-stone-500">
          No hay miembros en el equipo.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
      {members.map((member) => {
        const isCurrentUser = member.user_id === currentUserId;

        return (
          <div
            key={member.id}
            className="flex items-center gap-4 px-5 py-4"
          >
            {/* Avatar */}
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-medium text-stone-600 ring-1 ring-stone-200/60">
              {initialsFrom(member)}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-stone-900">
                {displayLabel(member, currentUserId)}
                {isCurrentUser && (
                  <span className="ml-1.5 text-xs font-normal text-stone-400">
                    (tú)
                  </span>
                )}
              </p>
              <p className="text-xs text-stone-500">
                {member.email ?? "Sin email"}
              </p>
            </div>

            {/* Role + joined date */}
            <div className="shrink-0 text-right">
              <Badge
                variant={ROLE_VARIANT[member.role] ?? "secondary"}
                className="text-[11px]"
              >
                {ROLE_LABELS[member.role] ?? member.role}
              </Badge>
              <p className="mt-1 text-[11px] text-stone-400">
                {new Date(member.created_at).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
