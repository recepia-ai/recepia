"use client";

import { Loader2, MessageCircle, PhoneCall } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { type ChannelSettings, savePhoneChannel, saveWhatsAppChannel } from "./channel-actions";

const inputClass =
  "h-10 w-full rounded-lg border border-stone-200 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

export function ConversationChannelsCard({ settings }: { settings: ChannelSettings }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  const submit =
    (action: (data: FormData) => Promise<{ success?: boolean; error?: string }>) =>
    (formData: FormData) => {
      startTransition(async () => {
        const result = await action(formData);
        if (result.error) toast.error(result.error);
        else {
          toast.success("Canal guardado de forma segura");
          router.refresh();
        }
      });
    };

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <form
        action={submit(saveWhatsAppChannel)}
        className="rounded-xl border border-stone-200 bg-white p-5 shadow-card"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <MessageCircle className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-900">WhatsApp · 360dialog</h3>
            <p className="mt-0.5 text-xs text-stone-500">
              La clave se cifra en Vault y nunca vuelve al navegador.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          <input
            className={inputClass}
            name="identifier"
            placeholder="Número +34…"
            defaultValue={settings.whatsapp?.identifier}
            required
          />
          <input
            className={inputClass}
            name="phone_number_id"
            placeholder="Phone Number ID de Meta"
            defaultValue={settings.whatsapp?.phoneNumberId}
            required
          />
          <input
            className={inputClass}
            name="waba_id"
            placeholder="WABA ID (opcional)"
            defaultValue={settings.whatsapp?.wabaId}
          />
          <input
            className={inputClass}
            name="api_key"
            type="password"
            autoComplete="new-password"
            placeholder={
              settings.whatsapp?.hasSecret ? "Nueva API key (sustituirá la actual)" : "D360 API key"
            }
            required
          />
        </div>
        <Button className="mt-4" size="sm" disabled={busy}>
          {busy && <Loader2 className="size-3.5 animate-spin" />}Guardar WhatsApp
        </Button>
      </form>

      <form
        action={submit(savePhoneChannel)}
        className="rounded-xl border border-stone-200 bg-white p-5 shadow-card"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
            <PhoneCall className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-stone-900">Teléfono · Vapi</h3>
            <p className="mt-0.5 text-xs text-stone-500">
              Contexto del cliente, transcripción y transferencia humana.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          <input
            className={inputClass}
            name="identifier"
            placeholder="Número de recepción +34…"
            defaultValue={settings.phone?.identifier}
            required
          />
          <input
            className={inputClass}
            name="vapi_phone_number_id"
            placeholder="Vapi Phone Number ID"
            defaultValue={settings.phone?.phoneNumberId}
            required
          />
          <input
            className={inputClass}
            name="assistant_id"
            placeholder="Vapi Assistant ID"
            defaultValue={settings.phone?.assistantId}
            required
          />
          <input
            className={inputClass}
            name="transfer_number"
            placeholder="Transferir a +34…"
            defaultValue={settings.phone?.transferNumber}
            required
          />
          <input
            className={inputClass}
            name="api_key"
            type="password"
            autoComplete="new-password"
            placeholder={
              settings.phone?.hasSecret
                ? "Nueva API key (sustituirá la actual)"
                : "Vapi private API key"
            }
            required
          />
        </div>
        <Button className="mt-4" size="sm" disabled={busy}>
          {busy && <Loader2 className="size-3.5 animate-spin" />}Guardar telefonía
        </Button>
      </form>
    </div>
  );
}
