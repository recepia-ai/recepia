"use client";

import { useState, useEffect, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import {
  initiateGoogleOAuth,
  disconnectGoogleCalendar,
} from "./integration-actions";
import type { IntegrationStatus } from "./integration-schema";

// ---------------------------------------------------------------------------
// GoogleCalendarCard — Client Component
// ---------------------------------------------------------------------------

export function GoogleCalendarCard({ status }: { status: IntegrationStatus }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, startTransition] = useTransition();
  const [showDisconnect, setShowDisconnect] = useState(false);

  // Handle success/error toasts from OAuth callback redirect
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success === "connected") {
      toast.success("Google Calendar conectado correctamente");
      // Clean the URL without a full page reload
      const url = new URL(window.location.href);
      url.searchParams.delete("success");
      window.history.replaceState({}, "", url.toString());
    }

    if (error) {
      const messages: Record<string, string> = {
        oauth_denied: "Has cancelado la autorización de Google Calendar.",
        missing_params: "Error: faltan parámetros en la respuesta de Google.",
        invalid_state: "Error de seguridad: el estado de la conexión no es válido.",
        token_exchange: "Error al intercambiar el código de autorización con Google.",
        config: "Error de configuración: faltan las credenciales de Google OAuth.",
      };
      toast.error(messages[error] ?? `Error inesperado al conectar Google Calendar (${error})`);
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  // Connect handler
  async function handleConnect() {
    startTransition(async () => {
      const result = await initiateGoogleOAuth();
      if (result.redirectUrl) {
        router.push(result.redirectUrl);
      } else if (result.error) {
        toast.error(result.error);
      }
    });
  }

  // Disconnect handler
  async function handleDisconnect() {
    setShowDisconnect(false);
    startTransition(async () => {
      const result = await disconnectGoogleCalendar();
      if (result.success) {
        toast.success("Google Calendar desconectado");
        router.refresh();
      } else if (result.error) {
        toast.error(result.error);
      }
    });
  }

  const formattedDate = status.connectedAt
    ? new Date(status.connectedAt).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <>
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-stone-50 border border-stone-200">
            <Calendar className="size-5 text-stone-600" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-stone-900">
              Google Calendar
            </h3>
            <p className="mt-0.5 text-xs text-stone-500">
              Conecta Google Calendar para que el asistente IA pueda consultar y
              crear citas automáticamente.
            </p>
          </div>
        </div>

        {/* Status */}
        {status.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge
                variant="default"
                className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200 text-xs"
              >
                Conectado
              </Badge>
            </div>

            <div className="space-y-1.5">
              {status.email && (
                <div className="flex items-center justify-between py-1 text-sm">
                  <span className="text-stone-500">Cuenta</span>
                  <span className="font-medium text-stone-900">{status.email}</span>
                </div>
              )}
              {formattedDate && (
                <div className="flex items-center justify-between py-1 text-sm">
                  <span className="text-stone-500">Conectado el</span>
                  <span className="font-medium text-stone-900">{formattedDate}</span>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDisconnect(true)}
              disabled={busy}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
              ) : null}
              Desconectar
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleConnect}
            disabled={busy}
            variant="default"
            size="sm"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
            ) : null}
            Conectar Google Calendar
          </Button>
        )}
      </div>

      {/* Disconnect confirmation dialog */}
      <AlertDialog open={showDisconnect} onOpenChange={setShowDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desconectar Google Calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              El asistente IA ya no podrá consultar ni crear citas en el
              calendario. Se eliminarán todas las vinculaciones de calendarios
              de veterinarios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={busy}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={1.75} />
              ) : null}
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
