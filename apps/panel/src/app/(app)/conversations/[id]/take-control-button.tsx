"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { takeControl } from "./conversation-actions";

type Props = {
  conversationId: string;
};

export function TakeControlButton({ conversationId }: Props) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("conversation_id", conversationId);

      const result = await takeControl({}, formData);
      if (result.success) {
        toast.success("Has tomado el control");
      } else if (result.error) {
        toast.error(result.error);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={busy}
      className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
    >
      {busy ? (
        <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
      ) : null}
      Tomar control
    </Button>
  );
}
