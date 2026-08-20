"use client";

import { ArrowUp, Loader2, Phone, Sparkles } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  sender: "client" | "agent" | "system";
  content: string;
};

function normalizeSpanishPhone(value: string): string | null {
  const compact = value.replace(/[\s()-]/g, "");
  if (/^[679][0-9]{8}$/.test(compact)) return `+34${compact}`;
  if (/^\+[1-9][0-9]{6,14}$/.test(compact)) return compact;
  return null;
}

export function ChatWidget({ clinicSlug, clinicName }: { clinicSlug: string; clinicName: string }) {
  const [sessionId, setSessionId] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneConfirmed, setPhoneConfirmed] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const seenServerMessages = useRef(new Set<string>());

  useEffect(() => {
    setSessionId(crypto.randomUUID());
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  });

  useEffect(() => {
    if (!phoneConfirmed || !sessionId) return;
    let cancelled = false;

    const syncMessages = async () => {
      const query = new URLSearchParams({ clinicSlug, sessionId, phone });
      const response = await fetch(`/api/channels/web/messages?${query}`, { cache: "no-store" });
      if (!response.ok || cancelled) return;
      const result = (await response.json()) as {
        messages?: Array<{
          id: string;
          sender: "agent" | "human" | "system";
          content: string | null;
        }>;
      };
      const fresh = (result.messages ?? []).filter(
        (message) => message.content && !seenServerMessages.current.has(message.id),
      );
      if (!fresh.length) return;
      for (const message of fresh) seenServerMessages.current.add(message.id);
      setMessages((current) => [
        ...current,
        ...fresh.map((message) => ({
          id: message.id,
          sender: message.sender === "system" ? ("system" as const) : ("agent" as const),
          content: message.content ?? "",
        })),
      ]);
    };

    void syncMessages();
    const interval = window.setInterval(() => void syncMessages(), 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [clinicSlug, phone, phoneConfirmed, sessionId]);

  const confirmPhone = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeSpanishPhone(phone);
    if (!normalized) {
      setPhoneError("Escribe un teléfono válido, por ejemplo +34 600 000 000.");
      return;
    }
    setPhone(normalized);
    setPhoneError(null);
    setPhoneConfirmed(true);
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || sending || !sessionId) return;

    const messageId = crypto.randomUUID();
    setMessages((current) => [...current, { id: messageId, sender: "client", content }]);
    setInput("");
    setSending(true);

    try {
      const response = await fetch("/api/channels/web/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clinicSlug, sessionId, messageId, message: content, phone }),
      });
      const result = (await response.json()) as {
        response?: string | null;
        queuedForHuman?: boolean;
        error?: string;
      };

      if (!response.ok) throw new Error(result.error ?? "No se pudo enviar el mensaje.");

      if (result.queuedForHuman) {
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            sender: "system",
            content: "Tu mensaje ha quedado en manos del equipo del hospital.",
          },
        ]);
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          sender: "system",
          content:
            error instanceof Error
              ? error.message
              : "No hemos podido enviar el mensaje. Inténtalo de nuevo.",
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[min(720px,calc(100dvh-2rem))] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl shadow-stone-900/10">
      <header className="flex items-center gap-3 border-b border-stone-200 bg-emerald-700 px-5 py-4 text-white">
        <div className="flex size-10 items-center justify-center rounded-full bg-white/15">
          <Sparkles className="size-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-sm font-semibold">Recepción de {clinicName}</h1>
          <p className="text-xs text-emerald-100">Agente de IA del equipo del hospital</p>
        </div>
      </header>

      {!phoneConfirmed ? (
        <form onSubmit={confirmPhone} className="flex flex-1 flex-col justify-center p-6">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <Phone className="size-5" strokeWidth={1.75} />
          </div>
          <h2 className="mt-4 text-center text-lg font-semibold text-stone-900">
            ¿Cuál es tu teléfono?
          </h2>
          <p className="mt-2 text-center text-sm leading-6 text-stone-500">
            Lo usamos para localizar tu ficha y las mascotas asociadas antes de atenderte.
          </p>
          <label htmlFor="chat-phone" className="mt-6 text-xs font-medium text-stone-600">
            Número de teléfono
          </label>
          <input
            id="chat-phone"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+34 600 000 000"
            className="mt-2 h-11 rounded-lg border border-stone-200 px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
          {phoneError && <p className="mt-2 text-xs text-rose-600">{phoneError}</p>}
          <button
            type="submit"
            className="mt-4 h-11 rounded-lg bg-emerald-700 text-sm font-medium text-white transition hover:bg-emerald-800"
          >
            Empezar conversación
          </button>
          <p className="mt-4 text-center text-[11px] leading-5 text-stone-400">
            Puedes pedir hablar con una persona del equipo en cualquier momento.
          </p>
        </form>
      ) : (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto bg-stone-50 px-4 py-5">
            {messages.length === 0 && (
              <div className="rounded-xl border border-stone-200 bg-white p-4 text-sm leading-6 text-stone-600">
                Escribe tu consulta. Puedo ayudarte con citas, información del hospital y gestiones
                habituales.
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.sender === "client"
                    ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-emerald-700 px-4 py-2.5 text-sm text-white"
                    : message.sender === "agent"
                      ? "mr-auto max-w-[85%] rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-sm leading-6 text-stone-800 shadow-sm ring-1 ring-stone-200"
                      : "mx-auto max-w-[90%] rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 ring-1 ring-amber-200"
                }
              >
                {message.content}
              </div>
            ))}
            {sending && (
              <div className="mr-auto inline-flex items-center gap-2 rounded-2xl rounded-bl-md bg-white px-4 py-3 text-xs text-stone-500 shadow-sm ring-1 ring-stone-200">
                <Loader2 className="size-3.5 animate-spin" /> Recepia está consultando tu ficha…
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={sendMessage}
            className="flex items-end gap-2 border-t border-stone-200 p-3"
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Escribe tu mensaje…"
              rows={1}
              disabled={sending}
              className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending || !sessionId}
              aria-label="Enviar mensaje"
              className="flex size-10 items-center justify-center rounded-full bg-emerald-700 text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowUp className="size-4" strokeWidth={2} />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
