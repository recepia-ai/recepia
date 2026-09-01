"use client";

import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type FacebookLoginResponse = {
  authResponse?: { code?: string };
  status?: string;
};

type FacebookSdk = {
  init(options: {
    appId: string;
    autoLogAppEvents: boolean;
    xfbml: boolean;
    version: string;
  }): void;
  login(
    callback: (response: FacebookLoginResponse) => void,
    options: {
      config_id: string;
      response_type: "code";
      override_default_response_type: true;
      extras: {
        setup: Record<string, never>;
        featureType: "whatsapp_business_app_onboarding";
        sessionInfoVersion: "3";
      };
    },
  ): void;
};

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

type SignupAssets = {
  wabaId: string;
  phoneNumberId?: string;
  businessId?: string;
  onboarding: "coexistence" | "cloud_api";
};

function isFacebookOrigin(origin: string) {
  try {
    const hostname = new URL(origin).hostname;
    return hostname === "facebook.com" || hostname.endsWith(".facebook.com");
  } catch {
    return false;
  }
}

export function MetaEmbeddedSignupButton({
  appId,
  configurationId,
  connected,
}: {
  appId?: string;
  configurationId?: string;
  connected: boolean;
}) {
  const router = useRouter();
  const [sdkReady, setSdkReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const codeRef = useRef<string | undefined>(undefined);
  const assetsRef = useRef<SignupAssets | undefined>(undefined);
  const submittingRef = useRef(false);

  const finish = useCallback(async () => {
    const code = codeRef.current;
    const assets = assetsRef.current;
    if (!code || !assets || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const response = await fetch("/api/integrations/whatsapp/meta/embedded-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, ...assets }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        identifier?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "No se pudo completar la conexión");
      toast.success(`WhatsApp ${body.identifier ?? ""} conectado a esta clínica`.trim());
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo completar la conexión");
    } finally {
      codeRef.current = undefined;
      assetsRef.current = undefined;
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [router]);

  useEffect(() => {
    if (!appId || !configurationId) return;

    window.fbAsyncInit = () => {
      window.FB?.init({
        appId,
        autoLogAppEvents: true,
        xfbml: true,
        version: "v26.0",
      });
      setSdkReady(Boolean(window.FB));
    };

    const existing = document.getElementById("facebook-jssdk");
    if (existing) {
      if (window.FB) window.fbAsyncInit();
    } else {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.src = "https://connect.facebook.net/es_ES/sdk.js";
      document.body.appendChild(script);
    }

    const sessionListener = (event: MessageEvent) => {
      if (!isFacebookOrigin(event.origin)) return;
      try {
        const payload =
          typeof event.data === "string" ? (JSON.parse(event.data) as unknown) : event.data;
        if (!payload || typeof payload !== "object") return;
        const message = payload as {
          type?: string;
          event?: string;
          data?: Record<string, unknown>;
        };
        if (message.type !== "WA_EMBEDDED_SIGNUP") return;

        if (message.event === "CANCEL") {
          const detail = message.data?.error_message ?? message.data?.current_step;
          toast.error(
            typeof detail === "string"
              ? `Alta de WhatsApp interrumpida en: ${detail}`
              : "Alta de WhatsApp cancelada",
          );
          return;
        }

        const wabaId = message.data?.waba_id;
        const phoneNumberId = message.data?.phone_number_id;
        const businessId = message.data?.business_id;
        if (typeof wabaId !== "string") return;
        const coexistence = message.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING";
        if (!coexistence && typeof phoneNumberId !== "string") return;
        assetsRef.current = {
          wabaId,
          phoneNumberId: typeof phoneNumberId === "string" ? phoneNumberId : undefined,
          businessId: typeof businessId === "string" ? businessId : undefined,
          onboarding: coexistence ? "coexistence" : "cloud_api",
        };
        void finish();
      } catch {
        // Other Facebook SDK messages are not Embedded Signup events.
      }
    };
    window.addEventListener("message", sessionListener);
    return () => window.removeEventListener("message", sessionListener);
  }, [appId, configurationId, finish]);

  const launch = () => {
    if (!window.FB || !configurationId) {
      toast.error("El registro de Meta todavía no está disponible");
      return;
    }
    codeRef.current = undefined;
    assetsRef.current = undefined;
    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          toast.error("Meta no autorizó la conexión");
          return;
        }
        codeRef.current = code;
        void finish();
      },
      {
        config_id: configurationId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "whatsapp_business_app_onboarding",
          sessionInfoVersion: "3",
        },
      },
    );
  };

  const configured = Boolean(appId && configurationId);
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-blue-700" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-stone-900">
            {connected ? "WhatsApp oficial conectado" : "Conexión oficial para cada clínica"}
          </p>
          <p className="mt-1 text-xs leading-5 text-stone-600">
            La clínica inicia sesión en Meta, elige o crea su cuenta de WhatsApp y verifica su
            número. Recepia guarda sus credenciales cifradas y activa los webhooks automáticamente.
          </p>
          <Button
            className="mt-3 bg-[#1877f2] hover:bg-[#166fe5]"
            size="sm"
            type="button"
            disabled={!configured || !sdkReady || submitting}
            onClick={launch}
          >
            {submitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ExternalLink className="size-3.5" />
            )}
            {connected ? "Reconectar con Meta" : "Conectar WhatsApp con Meta"}
          </Button>
          {!configured && (
            <p className="mt-2 text-xs text-amber-700">
              Pendiente de crear la configuración Embedded Signup v4 en Meta.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
