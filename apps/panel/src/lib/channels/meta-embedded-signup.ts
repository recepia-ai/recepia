import { randomInt } from "node:crypto";

const GRAPH_API_VERSION = "v26.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

type GraphErrorBody = {
  error?: {
    code?: number;
    error_subcode?: number;
    message?: string;
    type?: string;
  };
};

export class MetaEmbeddedSignupError extends Error {
  constructor(
    message: string,
    readonly step: "exchange" | "subscribe" | "register" | "phone",
    readonly status?: number,
  ) {
    super(message);
    this.name = "MetaEmbeddedSignupError";
  }
}

async function graphJson<T>(
  url: URL | string,
  init: RequestInit,
  step: MetaEmbeddedSignupError["step"],
): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as T & GraphErrorBody;
  if (!response.ok) {
    const detail = body.error?.message ?? "Meta no devolvió detalles";
    throw new MetaEmbeddedSignupError(`${step}: ${detail}`, step, response.status);
  }
  return body;
}

export type MetaPhoneDetails = {
  id?: string;
  display_phone_number: string;
  verified_name?: string;
  status?: string;
  quality_rating?: string;
};

export async function completeMetaEmbeddedSignup(input: {
  appId: string;
  appSecret: string;
  code: string;
  wabaId: string;
  phoneNumberId?: string;
  coexistence: boolean;
}) {
  const exchangeUrl = new URL(`${GRAPH_API_BASE}/oauth/access_token`);
  exchangeUrl.searchParams.set("client_id", input.appId);
  exchangeUrl.searchParams.set("client_secret", input.appSecret);
  exchangeUrl.searchParams.set("code", input.code);

  const tokenResult = await graphJson<{ access_token?: string; expires_in?: number }>(
    exchangeUrl,
    { method: "GET" },
    "exchange",
  );
  if (!tokenResult.access_token) {
    throw new MetaEmbeddedSignupError(
      "exchange: Meta no devolvió el identificador empresarial",
      "exchange",
    );
  }

  const authorization = { Authorization: `Bearer ${tokenResult.access_token}` };
  await graphJson<{ success?: boolean }>(
    `${GRAPH_API_BASE}/${encodeURIComponent(input.wabaId)}/subscribed_apps`,
    { method: "POST", headers: authorization },
    "subscribe",
  );

  let phoneNumberId = input.phoneNumberId;
  if (!phoneNumberId) {
    const phoneNumbersUrl = new URL(
      `${GRAPH_API_BASE}/${encodeURIComponent(input.wabaId)}/phone_numbers`,
    );
    phoneNumbersUrl.searchParams.set(
      "fields",
      "id,display_phone_number,verified_name,status,quality_rating",
    );
    const phoneNumbers = await graphJson<{ data?: MetaPhoneDetails[] }>(
      phoneNumbersUrl,
      { headers: authorization },
      "phone",
    );
    if (phoneNumbers.data?.length !== 1 || !phoneNumbers.data[0]?.id) {
      throw new MetaEmbeddedSignupError(
        "phone: Meta no devolvió un único número para la cuenta conectada",
        "phone",
      );
    }
    phoneNumberId = phoneNumbers.data[0].id;
  }

  const registrationPin = input.coexistence
    ? undefined
    : randomInt(0, 1_000_000).toString().padStart(6, "0");
  if (registrationPin) {
    await graphJson<{ success?: boolean }>(
      `${GRAPH_API_BASE}/${encodeURIComponent(phoneNumberId)}/register`,
      {
        method: "POST",
        headers: { ...authorization, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", pin: registrationPin }),
      },
      "register",
    );
  }

  const fields = new URL(`${GRAPH_API_BASE}/${encodeURIComponent(phoneNumberId)}`);
  fields.searchParams.set(
    "fields",
    "display_phone_number,verified_name,status,quality_rating",
  );
  const phone = await graphJson<MetaPhoneDetails>(fields, { headers: authorization }, "phone");

  return {
    accessToken: tokenResult.access_token,
    registrationPin,
    phoneNumberId,
    graphApiVersion: GRAPH_API_VERSION,
    tokenExpiresAt:
      typeof tokenResult.expires_in === "number"
        ? new Date(Date.now() + tokenResult.expires_in * 1000).toISOString()
        : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    phone,
  };
}
