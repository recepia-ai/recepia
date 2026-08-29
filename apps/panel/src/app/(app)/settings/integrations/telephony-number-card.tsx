import type { TelephonyNumberView } from "./telephony-actions";

// ---------------------------------------------------------------------------
// Tarjeta de solo lectura: número de teléfono de la clínica y estado del
// Regulatory Bundle. Los datos vienen de v_clinic_telephony (sin coste interno).
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  pending_purchase: "Pendiente de compra",
  pending_bundle: "Pendiente de bundle",
  active: "Activo",
  suspended: "Suspendido",
  released: "Liberado",
};

const BUNDLE_LABEL: Record<string, string> = {
  draft: "Borrador",
  pending_review: "Enviado a revisión",
  in_review: "En revisión",
  twilio_approved: "Aprobado",
  twilio_rejected: "Rechazado",
  provisionally_approved: "Aprobado (provisional)",
  expired: "Caducado",
};

const BILLING_LABEL: Record<string, string> = {
  included_in_subscription: "Incluido en la suscripción",
  passthrough_line_item: "Facturado como línea aparte",
  client_owned: "Número del cliente",
};

function toneFor(value: string): string {
  if (value === "active" || value === "twilio_approved" || value === "provisionally_approved") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  }
  if (value === "twilio_rejected" || value === "suspended" || value === "expired") {
    return "bg-red-50 text-red-700 ring-red-200";
  }
  if (value === "released") {
    return "bg-stone-100 text-stone-500 ring-stone-200";
  }
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function Badge({ value, label }: { value: string; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${toneFor(value)}`}
    >
      {label}
    </span>
  );
}

export function TelephonyNumberCard({ numbers }: { numbers: TelephonyNumberView[] }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Teléfono · Número (Twilio)</h3>
          <p className="mt-0.5 text-xs text-stone-500">
            Número de la clínica y estado de su registro regulatorio.
          </p>
        </div>
      </div>

      {numbers.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">
          Todavía no hay ningún número asignado a la clínica.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {numbers.map((number) => (
            <li
              key={number.id}
              className="flex flex-col gap-2 rounded-lg border border-stone-100 bg-stone-50/60 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm font-medium text-stone-900">{number.phoneNumber}</p>
                <p className="mt-0.5 text-xs text-stone-500">
                  {number.numberType ? `${number.numberType} · ` : ""}
                  {number.countryCode}
                  {" · "}
                  {BILLING_LABEL[number.billingModel] ?? number.billingModel}
                  {number.billedMonthlyPrice != null
                    ? ` · ${number.billedMonthlyPrice} ${number.currency}/mes`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <Badge value={number.status} label={STATUS_LABEL[number.status] ?? number.status} />
                <Badge
                  value={number.bundleStatus}
                  label={`Bundle: ${BUNDLE_LABEL[number.bundleStatus] ?? number.bundleStatus}`}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
