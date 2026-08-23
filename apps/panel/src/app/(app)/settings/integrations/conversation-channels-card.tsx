"use client";

import { Loader2, MessageCircle, PhoneCall } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { type ChannelSettings, savePhoneChannel, saveWhatsAppChannel } from "./channel-actions";

const inputClass =
  "h-10 w-full rounded-lg border border-stone-200 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

export function ConversationChannelsCard({ settings }: { settings: ChannelSettings }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [whatsappProvider, setWhatsAppProvider] = useState<
    "meta_cloud" | "360dialog" | "evolution"
  >(settings.whatsapp?.provider ?? "meta_cloud");

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
            <h3 className="text-sm font-semibold text-stone-900">WhatsApp</h3>
            <p className="mt-0.5 text-xs text-stone-500">
              Evolution para la demostración; Meta y 360dialog quedan preparados.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          <select
            className={inputClass}
            name="provider"
            value={whatsappProvider}
            onChange={(event) =>
              setWhatsAppProvider(event.target.value as "meta_cloud" | "360dialog" | "evolution")
            }
          >
            <option value="meta_cloud">Meta Cloud API directa</option>
            <option value="360dialog">360dialog (producción futura)</option>
            <option value="evolution">Evolution API (demostración temporal)</option>
          </select>
          <input
            className={inputClass}
            name="identifier"
            placeholder="Número +34…"
            defaultValue={settings.whatsapp?.identifier}
            required
          />
          {whatsappProvider !== "evolution" && (
            <>
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
            </>
          )}
          {whatsappProvider === "meta_cloud" && (
            <input
              className={inputClass}
              name="graph_api_version"
              placeholder="Versión Graph API mostrada por Meta (ej. v23.0)"
              defaultValue={settings.whatsapp?.graphApiVersion}
              required
            />
          )}
          {whatsappProvider === "evolution" && (
            <>
              <input
                className={inputClass}
                name="evolution_base_url"
                type="url"
                placeholder="URL de Evolution API (https://…)"
                defaultValue={settings.whatsapp?.evolutionBaseUrl}
                required
              />
              <input
                className={inputClass}
                name="evolution_instance_name"
                placeholder="Nombre de la instancia (ej. recepia-demo)"
                defaultValue={settings.whatsapp?.evolutionInstanceName}
                required
              />
            </>
          )}
          <input
            className={inputClass}
            name="api_key"
            type="password"
            autoComplete="new-password"
            placeholder={
              settings.whatsapp?.hasSecret
                ? whatsappProvider === "meta_cloud"
                  ? "Nuevo access token (sustituirá el actual)"
                  : whatsappProvider === "evolution"
                    ? "Nueva API key de Evolution (sustituirá la actual)"
                    : "Nueva D360 API key (sustituirá la actual)"
                : whatsappProvider === "meta_cloud"
                  ? "Access token temporal de Meta"
                  : whatsappProvider === "evolution"
                    ? "API key de Evolution"
                    : "D360 API key"
            }
            required
          />
        </div>
        {whatsappProvider === "meta_cloud" && (
          <p className="mt-3 text-xs leading-5 text-amber-700">
            Usa exclusivamente el número de prueba de Meta. No introduzcas aquí el número real del
            hospital durante la demostración.
          </p>
        )}
        {whatsappProvider === "evolution" && (
          <p className="mt-3 text-xs leading-5 text-amber-700">
            Usa solo un número de pruebas prescindible. Evolution utiliza WhatsApp Web y no debe
            conectarse al número real del hospital.
          </p>
        )}
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
