"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { returnToAgent } from "./conversation-actions";

type Props = {
  conversationId: string;
};

export function ReturnToAgentButton({ conversationId }: Props) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("conversation_id", conversationId);

      const result = await returnToAgent({}, formData);
      if (result.success) {
        toast.success("Devuelto al agente");
        setOpen(false);
      } else if (result.error) {
        toast.error(result.error);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} disabled={busy}>
        {busy ? <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} /> : null}
        Devolver a IA
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Devolver la conversación a la IA?</AlertDialogTitle>
          <AlertDialogDescription>
            Recepia podrá responder automáticamente a los próximos mensajes del cliente. Comprueba
            antes que el equipo ya no está atendiendo este caso.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Mantener control humano</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
          >
            {busy && <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />}
            Devolver a IA
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
