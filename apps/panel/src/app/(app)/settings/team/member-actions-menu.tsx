"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { updateMemberRole, removeMember } from "./team-actions";
import type { TeamMember } from "./team-list";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  recepcion: "Recepción",
  veterinario: "Veterinario",
};

const ALL_ROLES = ["admin", "recepcion", "veterinario"] as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  member: TeamMember;
  currentUserId: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MemberActionsMenu({ member, currentUserId }: Props) {
  const isCurrentUser = member.user_id === currentUserId;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<{
    type: "role";
    targetRole: string;
  } | {
    type: "remove";
  } | null>(null);

  // ---- Role change ----
  const handleRoleClick = (newRole: string) => {
    setConfirmAction({ type: "role", targetRole: newRole });
  };

  const executeRoleChange = async () => {
    if (confirmAction?.type !== "role") return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("member_id", member.id);
      formData.set("new_role", confirmAction.targetRole);

      const result = await updateMemberRole({}, formData);
      if (result.success) {
        toast.success("Rol actualizado");
      } else if (result.error) {
        toast.error(result.error);
      }
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  };

  // ---- Remove ----
  const handleRemoveClick = () => {
    setConfirmAction({ type: "remove" });
  };

  const executeRemove = async () => {
    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("member_id", member.id);

      const result = await removeMember({}, formData);
      if (result.success) {
        toast.success("Miembro eliminado del equipo");
      } else if (result.error) {
        toast.error(result.error);
      }
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  };

  const memberLabel =
    member.display_name ?? member.email ?? member.user_id.slice(0, 8) + "…";

  const targetRoleLabel =
    confirmAction?.type === "role"
      ? ROLE_LABELS[confirmAction.targetRole] ?? confirmAction.targetRole
      : "";

  return (
    <>
      {/* ---- Dropdown ---- */}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            aria-label="Acciones de miembro"
          >
            <MoreHorizontal className="size-4" strokeWidth={1.75} />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          {ALL_ROLES.filter((r) => r !== member.role).map((role) => (
            <DropdownMenuItem
              key={role}
              onClick={() => handleRoleClick(role)}
              disabled={busy}
              className="text-sm"
            >
              Cambiar a {ROLE_LABELS[role]}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={handleRemoveClick}
            disabled={busy}
            variant="destructive"
            className="text-sm"
          >
            Eliminar del equipo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ---- Confirmation dialogs ---- */}

      {/* Role change confirmation */}
      <AlertDialog
        open={confirmAction?.type === "role"}
        onOpenChange={(v) => {
          if (!v) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambiar rol de miembro</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Cambiar el rol de{" "}
              <span className="font-medium text-stone-700">{memberLabel}</span>{" "}
              a{" "}
              <span className="font-medium text-stone-700">
                {targetRoleLabel}
              </span>
              ? Esto le dará o quitará permisos administrativos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeRoleChange}
              disabled={busy}
            >
              {busy ? "Cambiando…" : "Cambiar rol"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove confirmation */}
      <AlertDialog
        open={confirmAction?.type === "remove"}
        onOpenChange={(v) => {
          if (!v) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar del equipo</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Eliminar a{" "}
              <span className="font-medium text-stone-700">{memberLabel}</span>{" "}
              del equipo? Perderá acceso a la clínica. Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeRemove}
              disabled={busy}
              variant="destructive"
            >
              {busy ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
