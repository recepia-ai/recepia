/**
 * Cliente REST mínimo de Twilio.
 *
 * Las credenciales se leen del entorno (Doppler las inyecta); NUNCA se hardcodean.
 * Sigue el estilo dependency-light basado en `fetch` de google-calendar-provisioning.ts
 * (sin añadir el SDK `twilio`).
 *
 * Dos bases de API:
 *   - core    → https://api.twilio.com/2010-04-01  (Addresses, AvailablePhoneNumbers, IncomingPhoneNumbers)
 *   - numbers → https://numbers.twilio.com/v2      (RegulatoryCompliance: EndUsers, SupportingDocuments, Bundles)
 *
 * Variables Doppler requeridas:
 *   - TWILIO_ACCOUNT_SID  (AC…)  — cuenta Customer (Recepia)
 *   - TWILIO_AUTH_TOKEN          — secreto de la API
 */

const CORE_API = "https://api.twilio.com/2010-04-01";
const NUMBERS_API = "https://numbers.twilio.com/v2";

type TwilioCreds = { accountSid: string; authToken: string };

/** Lee las credenciales del entorno (Doppler). Lanza si faltan, como createAdminClient. */
function twilioCreds(): TwilioCreds {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN (Doppler)");
  }
  return { accountSid, authToken };
}

/** SID de la cuenta Customer (para construir rutas /Accounts/{sid}/…). */
export function twilioAccountSid(): string {
  return twilioCreds().accountSid;
}

function authHeader({ accountSid, authToken }: TwilioCreds): string {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

/**
 * Twilio consume application/x-www-form-urlencoded. Los parámetros de tipo array
 * (p. ej. varios SupportingDocumentSids) se repiten con la misma clave.
 */
function encodeForm(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) usp.append(key, String(item));
    } else {
      usp.append(key, String(value));
    }
  }
  return usp.toString();
}

export type TwilioResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

type Method = "GET" | "POST";

async function request<T>(
  baseUrl: string,
  method: Method,
  path: string,
  params?: Record<string, unknown>,
): Promise<TwilioResult<T>> {
  const creds = twilioCreds();
  const headers: Record<string, string> = { Authorization: authHeader(creds) };

  let url = `${baseUrl}${path}`;
  const init: RequestInit = { method, headers };

  if (method === "GET") {
    if (params) {
      const qs = encodeForm(params);
      if (qs) url += `?${qs}`;
    }
  } else {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = encodeForm(params ?? {});
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Twilio network error",
    };
  }

  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    [k: string]: unknown;
  };

  if (!response.ok) {
    console.error("[twilio-client] request failed", {
      method,
      path,
      status: response.status,
      message: payload?.message,
    });
    return {
      ok: false,
      status: response.status,
      error: payload?.message ?? `Twilio HTTP ${response.status}`,
    };
  }

  return { ok: true, data: payload as T };
}

/** Llama a la Core API (https://api.twilio.com/2010-04-01). `path` empieza por "/". */
export function twilioCore<T>(
  method: Method,
  path: string,
  params?: Record<string, unknown>,
): Promise<TwilioResult<T>> {
  return request<T>(CORE_API, method, path, params);
}

/** Llama a la Numbers/RegulatoryCompliance API (https://numbers.twilio.com/v2). */
export function twilioNumbers<T>(
  method: Method,
  path: string,
  params?: Record<string, unknown>,
): Promise<TwilioResult<T>> {
  return request<T>(NUMBERS_API, method, path, params);
}
