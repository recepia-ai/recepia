/**
 * Sincroniza el estado del Regulatory Bundle desde Twilio a telephony_numbers.
 *
 * Uso (Doppler inyecta TWILIO_* y SUPABASE_*):
 *   pnpm with-env -- npx tsx apps/panel/scripts/sync-bundle-status.ts [--clinic <CLINIC_ID>]
 *
 * Sin --clinic sincroniza todos los números con bundle. Idempotente y de solo lectura
 * en Twilio (GET); solo escribe en BD cuando el estado cambia. Úsalo entre la fase 2
 * (envío del bundle) y la fase 3 (compra), para que la compra vea 'twilio_approved'.
 */
import { syncBundleStatus } from "../src/lib/telephony/bundle-status";

async function main() {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--clinic");
  const clinicId = idx >= 0 ? args[idx + 1] : undefined;

  const result = await syncBundleStatus({ clinicId });
  if (!result.success) {
    console.error(`FALLO: ${result.error}`);
    process.exit(1);
  }

  if (result.synced.length === 0) {
    console.log("Sin bundles que sincronizar.");
    return;
  }

  let changed = 0;
  let errors = 0;
  for (const o of result.synced) {
    const mark = o.error ? "⚠️ " : o.changed ? "→ " : "= ";
    const transition = o.changed ? `${o.previous} → ${o.current}` : o.current;
    const suffix = o.error ? `  (${o.error})` : "";
    console.log(`${mark}${o.phoneNumber} [${o.bundleSid}]: ${transition}${suffix}`);
    if (o.error) errors++;
    else if (o.changed) changed++;
  }
  console.log(`\n${result.synced.length} bundle(s): ${changed} cambiados, ${errors} con error.`);
  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});
