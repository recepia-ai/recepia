/**
 * Lanzador manual del aprovisionamiento de un número Twilio para una clínica.
 *
 * Las credenciales (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, SUPABASE_*) se inyectan
 * por Doppler; NUNCA se pasan por CLI. Ejecutar desde la raíz del repo:
 *
 *   pnpm with-env -- npx tsx apps/panel/scripts/provision-twilio-number.ts \
 *     --clinic <CLINIC_ID> [--area-code 977] [--number-type local]
 *     [--confirm-submit-bundle] [--confirm-purchase]
 *     [--billing-model included_in_subscription] [--provider-cost 1.15] [--billed-price 5.00]
 *
 * Por defecto para en `regulatory_ready`: prepara End-User + Address + Bundle (draft),
 * SIN enviar el bundle ni comprar. Las acciones regulatorias/de pago exigen los flags
 * explícitos --confirm-submit-bundle y --confirm-purchase (este último es una COMPRA
 * real, irreversible, y solo procede con el bundle ya aprobado por Twilio).
 */
import { type NumberType, provisionTwilioNumber } from "../src/lib/telephony/provision";

type Argv = { flags: Set<string>; opts: Map<string, string> };

function parseArgv(argv: string[]): Argv {
  const flags = new Set<string>();
  const opts = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token || !token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      opts.set(key, next);
      i++;
    } else {
      flags.add(key);
    }
  }
  return { flags, opts };
}

const NUMBER_TYPES: NumberType[] = ["local", "mobile", "national"];
const BILLING_MODELS = [
  "included_in_subscription",
  "passthrough_line_item",
  "client_owned",
] as const;

async function main() {
  const { flags, opts } = parseArgv(process.argv.slice(2));

  const clinicId = opts.get("clinic");
  if (!clinicId) {
    console.error("Falta --clinic <CLINIC_ID>.");
    process.exit(1);
  }

  const numberTypeRaw = opts.get("number-type") ?? "local";
  if (!NUMBER_TYPES.includes(numberTypeRaw as NumberType)) {
    console.error(`--number-type inválido: ${numberTypeRaw}. Usa: ${NUMBER_TYPES.join(", ")}`);
    process.exit(1);
  }
  const numberType = numberTypeRaw as NumberType;

  const billingModelRaw = opts.get("billing-model");
  if (
    billingModelRaw &&
    !BILLING_MODELS.includes(billingModelRaw as (typeof BILLING_MODELS)[number])
  ) {
    console.error(
      `--billing-model inválido: ${billingModelRaw}. Usa: ${BILLING_MODELS.join(", ")}`,
    );
    process.exit(1);
  }

  const confirmSubmitBundle = flags.has("confirm-submit-bundle");
  const confirmPurchase = flags.has("confirm-purchase");

  const num = (key: string): number | undefined => {
    const raw = opts.get(key);
    if (raw == null) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };

  // Banner: deja claro qué acciones se van a intentar antes de llamar.
  console.log("── Aprovisionamiento Twilio ──────────────────────────────");
  console.log(`  clinic            : ${clinicId}`);
  console.log(`  numberType        : ${numberType}`);
  console.log(`  areaCode          : ${opts.get("area-code") ?? "(cualquiera)"}`);
  console.log(
    `  confirmSubmitBundle: ${confirmSubmitBundle}  ${confirmSubmitBundle ? "→ ENVIARÁ el bundle" : "(no envía)"}`,
  );
  console.log(
    `  confirmPurchase   : ${confirmPurchase}  ${confirmPurchase ? "→ COMPRARÁ el número (PAGO, irreversible)" : "(no compra)"}`,
  );
  console.log("──────────────────────────────────────────────────────────");

  const result = await provisionTwilioNumber({
    clinicId,
    areaCode: opts.get("area-code"),
    numberType,
    confirmSubmitBundle,
    confirmPurchase,
    billing: {
      model: billingModelRaw as (typeof BILLING_MODELS)[number] | undefined,
      providerMonthlyCost: num("provider-cost"),
      billedMonthlyPrice: num("billed-price"),
      currency: opts.get("currency"),
    },
  });

  if (!result.success) {
    console.error(`FALLO${result.stoppedAt ? ` (en ${result.stoppedAt})` : ""}: ${result.error}`);
    process.exit(1);
  }

  console.log(`OK — parada en: ${result.stoppedAt}`);
  console.log(result.message);
  if (result.phoneNumber) console.log(`  número     : ${result.phoneNumber}`);
  if (result.numberId) console.log(`  telephony_numbers.id: ${result.numberId}`);
  if (result.endUserSid) console.log(`  endUserSid : ${result.endUserSid}`);
  if (result.addressSid) console.log(`  addressSid : ${result.addressSid}`);
  if (result.bundleSid) console.log(`  bundleSid  : ${result.bundleSid}`);
  if (result.numberSid) console.log(`  numberSid  : ${result.numberSid}`);
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});
