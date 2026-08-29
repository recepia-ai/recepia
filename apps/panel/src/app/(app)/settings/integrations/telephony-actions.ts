import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Lectura de telefonía para el panel del cliente.
//
// Lee la vista v_clinic_telephony con el cliente autenticado (respeta RLS: la
// vista filtra por tenant y NO expone provider_monthly_cost). El admin de la
// clínica ve su número y el estado del Regulatory Bundle.
// ---------------------------------------------------------------------------

export type TelephonyNumberView = {
  id: string;
  phoneNumber: string;
  countryCode: string;
  numberType: string | null;
  status: string;
  bundleStatus: string;
  billingModel: string;
  billedMonthlyPrice: number | null;
  currency: string;
  createdAt: string;
};

export async function getTelephonyNumbers(): Promise<TelephonyNumberView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_clinic_telephony")
    .select(
      "id, phone_number, country_code, number_type, status, bundle_status, billing_model, billed_monthly_price, currency, created_at",
    )
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.flatMap((row) =>
    row.id && row.phone_number
      ? [
          {
            id: row.id,
            phoneNumber: row.phone_number,
            countryCode: row.country_code ?? "ES",
            numberType: row.number_type ?? null,
            status: row.status ?? "pending_purchase",
            bundleStatus: row.bundle_status ?? "draft",
            billingModel: row.billing_model ?? "included_in_subscription",
            billedMonthlyPrice: row.billed_monthly_price ?? null,
            currency: row.currency ?? "EUR",
            createdAt: row.created_at ?? "",
          },
        ]
      : [],
  );
}
