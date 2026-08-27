/**
 * Sincroniza el assistant de Vapi (Hospital Dr. Patino) desde codigo:
 * prompt de voz, primer mensaje y tools del agente. Asi el "cerebro" vive en
 * el backend y no dependemos del editor del dashboard (que se atraganta con
 * textos largos).
 *
 * Las tools NO llevan `server` propio: Vapi enruta las tool-calls al server
 * URL de la llamada (el del numero, con cabecera x-vapi-secret) hacia el
 * webhook /api/channels/phone/vapi, que las ejecuta con el registry del agente.
 *
 * Uso (no imprime la clave):
 *   cd apps/panel
 *   VAPI_PRIVATE_KEY=<tu_private_key> npx tsx scripts/sync-vapi-assistant.ts
 *
 * Opcional: VAPI_ASSISTANT_ID=<id> (por defecto el de Hospital Dr. Patino).
 */
import { buildVapiToolDefinitions } from "../src/lib/channels/vapi-tools";
import {
  VOICE_FIRST_MESSAGE,
  VOICE_SYSTEM_PROMPT,
} from "../src/lib/channels/vapi-voice-prompt";

const KEY = process.env.VAPI_PRIVATE_KEY;
const ASSISTANT_ID =
  process.env.VAPI_ASSISTANT_ID ?? "e2bb61c0-269c-4736-883a-da0d64005d42";
const API = "https://api.vapi.ai";

if (!KEY) {
  console.error("Falta VAPI_PRIVATE_KEY en el entorno.");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

type Msg = { role?: string; content?: string };

async function main() {
  // 1. Leer el assistant actual (para no pisar provider/modelo/voz).
  const getRes = await fetch(`${API}/assistant/${ASSISTANT_ID}`, { headers });
  if (!getRes.ok) {
    console.error(`GET assistant fallo (${getRes.status}):`, await getRes.text());
    process.exit(1);
  }
  const assistant = (await getRes.json()) as {
    model?: { messages?: Msg[]; [k: string]: unknown };
  };
  const model = { ...(assistant.model ?? {}) };

  // 2. Tools desde el registry.
  model.tools = buildVapiToolDefinitions();

  // 3. System prompt en model.messages (reemplaza el system si existe).
  const messages: Msg[] = Array.isArray(model.messages) ? [...model.messages] : [];
  const sysIdx = messages.findIndex((m) => m?.role === "system");
  const sysMsg: Msg = { role: "system", content: VOICE_SYSTEM_PROMPT };
  if (sysIdx >= 0) messages[sysIdx] = { ...messages[sysIdx], ...sysMsg };
  else messages.unshift(sysMsg);
  model.messages = messages;

  // 4. PATCH: model (prompt + tools) + primer mensaje.
  const patchRes = await fetch(`${API}/assistant/${ASSISTANT_ID}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ model, firstMessage: VOICE_FIRST_MESSAGE }),
  });
  if (!patchRes.ok) {
    console.error(`PATCH assistant fallo (${patchRes.status}):`, await patchRes.text());
    process.exit(1);
  }

  const tools = model.tools as { function: { name: string } }[];
  console.log(`OK. Assistant ${ASSISTANT_ID} sincronizado:`);
  console.log(`  - ${tools.length} tools: ${tools.map((t) => t.function.name).join(", ")}`);
  console.log(`  - system prompt (${VOICE_SYSTEM_PROMPT.length} chars) con reserva habilitada`);
  console.log(`  - primer mensaje actualizado`);
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});
