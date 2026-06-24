"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, RefreshCw, X } from "lucide-react";
import { resendInvitation, revokeInvitation } from "./team-actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PendingInvitation = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  recepcion: "Recepción",
  veterinario: "Veterinario",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function expiresIn(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expirada";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}d restante${days > 1 ? "s" : ""}`;
  if (hours > 0) return `${hours}h restante${hours > 1 ? "s" : ""}`;
  return "Menos de 1h";
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  invitations: PendingInvitation[];
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InvitationsList({ invitations }: Props) {
  if (invitations.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-stone-900">
          Invitaciones pendientes
        </h3>
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/10">
          {invitations.length}
        </span>
      </div>

      {/* List */}
      <div className="divide-y divide-stone-100 rounded-xl border border-amber-200/60 bg-white">
        {invitations.map((inv) => (
          <InvitationRow key={inv.id} invitation={inv} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single row
// ---------------------------------------------------------------------------

function InvitationRow({ invitation }: { invitation: PendingInvitation }) {
  const [busy, setBusy] = useState<"resend" | "revoke" | null>(null);

  const handleResend = async () => {
    setBusy("resend");
    try {
      const result = await resendInvitation(invitation.id);
      if (result.success) {
        toast.success("Invitación reenviada");
      } else if (result.error) {
        toast.error(result.error);
      }
    } finally {
      setBusy(null);
    }
  };

  const handleRevoke = async () => {
    setBusy("revoke");
    try {
      const result = await revokeInvitation(invitation.id);
      if (result.success) {
        toast.success("Invitación cancelada");
      } else if (result.error) {
        toast.error(result.error);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      {/* Avatar (email initial) */}
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-sm font-medium text-amber-600 ring-1 ring-amber-200">
        {invitation.email.slice(0, 2).toUpperCase()}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-stone-900">
          {invitation.email}
        </p>
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <Badge variant="outline" className="text-[11px]">
            {ROLE_LABELS[invitation.role] ?? invitation.role}
          </Badge>
          <span>·</span>
          <span>{expiresIn(invitation.expires_at)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-stone-500 hover:text-stone-700"
          disabled={busy !== null}
          onClick={handleResend}
        >
          {busy === "resend" ? (
            <RefreshCw className="size-3.5 animate-spin" strokeWidth={1.75} />
          ) : (
            <Mail className="size-3.5" strokeWidth={1.75} />
          )}
          <span className="sr-only">Reenviar</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-stone-400 hover:text-destructive"
          disabled={busy !== null}
          onClick={handleRevoke}
        >
          {busy === "revoke" ? (
            <RefreshCw className="size-3.5 animate-spin" strokeWidth={1.75} />
          ) : (
            <X className="size-3.5" strokeWidth={1.75} />
          )}
          <span className="sr-only">Cancelar</span>
        </Button>
      </div>
    </div>
  );
}
