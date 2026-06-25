"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { returnToAgent } from "./conversation-actions";

type Props = {
  conversationId: string;
};

export function ReturnToAgentButton({ conversationId }: Props) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("conversation_id", conversationId);

      const result = await returnToAgent({}, formData);
      if (result.success) {
        toast.success("Devuelto al agente");
      } else if (result.error) {
        toast.error(result.error);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={busy}
    >
      {busy ? (
        <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
      ) : null}
      Devolver al agente
    </Button>
  );
}
