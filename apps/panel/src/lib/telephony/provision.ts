/**
 * Aprovisionamiento de números de teléfono Twilio (multi-tenant).
 *
 * Customer = plataforma Recepia (credenciales Twilio, vía Doppler).
 * End-User  = la clínica (identidad legal en clinic_regulatory_info).
 *
 * Orquesta: End-User → Address → Bundle (draft) → [envío bundle] → [compra] → registro
 * en telephony_numbers. Escribe con service_role (createAdminClient), que bypassa RLS.
 *
 * PARADAS (acciones regulatorias / de pago detrás de flags que lanza el operador):
 *   #1 regulatory_ready  — por defecto: prepara todo, NO envía el bundle ni compra.
 *   #2 bundle_submitted  — con confirmSubmitBundle: envía el bundle y espera aprobación de Twilio.
 *   #3 number_purchased  — con confirmPurchase (y bundle aprobado): COMPRA el número (dinero, irreversible).
 *
 * NOTA: los nombres de campos regulatorios de Twilio (Attributes del EndUser, RegulationSid,
 * etc.) dependen de la regulación ES/local vigente. Marcados con "VERIFICAR" — confirmar
 * contra la doc de Twilio antes de la ejecución de pago.
 */
import type { Database } from "@recepia/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { twilioAccountSid, twilioCore, twilioNumbers } from "./twilio-client";

type RegulatoryInfo = Database["public"]["Tables"]["clinic_regulatory_info"]["Row"];
type TelephonyNumberRow = Database["public"]["Tables"]["telephony_numbers"]["Row"];
type BillingModel = Database["public"]["Enums"]["telephony_billing_model"];

export type NumberType = "local" | "mobile" | "national";

export type ProvisionStep =
  | "regulatory_ready"
  | "bundle_submitted"
  | "number_purchased"
  | "registered";

export type ProvisionOptions = {
  clinicId: string;
  areaCode?: string; // p. ej. "977" (Tarragona local)
  numberType?: NumberType;
  confirmSubmitBundle?: boolean; // gate: envío del Regulatory Bundle
  confirmPurchase?: boolean; // gate: compra del número (pago, irreversible)
  billing?: {
    model?: BillingModel;
    providerMonthlyCost?: number;
    billedMonthlyPrice?: number;
    currency?: string;
  };
};

export type ProvisionResult =
  | {
      success: true;
      stoppedAt: ProvisionStep;
      message: string;
      numberId?: string;
      phoneNumber?: string;
      endUserSid?: string | null;
      addressSid?: string | null;
      bundleSid?: string | null;
      numberSid?: string | null;
    }
  | { success: false; error: string; stoppedAt?: ProvisionStep };

// ---------------------------------------------------------------------------
// Helpers Twilio (una llamada por objeto). Devuelven el SID creado.
// ---------------------------------------------------------------------------

const NUMBER_TYPE_PATH: Record<NumberType, string> = {
  local: "Local",
  mobile: "Mobile",
  national: "National",
};

async function createEndUser(reg: RegulatoryInfo) {
  // VERIFICAR: Attributes exactos según la regulación ES (business_name, business_registration…).
  return twilioNumbers<{ sid: string }>("POST", "/RegulatoryCompliance/EndUsers", {
    FriendlyName: `${reg.legal_name} (Recepia End-User)`,
    Type: reg.end_user_type, // 'business' | 'individual'
    Attributes: JSON.stringify({
      business_name: reg.legal_name,
      business_registration_number: reg.tax_id,
      authorized_representative_1: reg.authorized_rep_name ?? undefined,
    }),
  });
}

async function createAddress(reg: RegulatoryInfo) {
  return twilioCore<{ sid: string }>(
    "POST",
    `/Accounts/${twilioAccountSid()}/Addresses.json`,
    {
      FriendlyName: `${reg.legal_name} (${reg.city})`,
      CustomerName: reg.legal_name,
      Street: reg.address_line1,
      City: reg.city,
      Region: reg.region,
      PostalCode: reg.postal_code,
      IsoCountry: reg.country_code,
    },
  );
}

async function searchAvailableNumber(
  isoCountry: string,
  numberType: NumberType,
  areaCode?: string,
) {
  const res = await twilioCore<{
    available_phone_numbers?: { phone_number: string }[];
  }>(
    "GET",
    `/Accounts/${twilioAccountSid()}/AvailablePhoneNumbers/${isoCountry}/${NUMBER_TYPE_PATH[numberType]}.json`,
    { AreaCode: areaCode, Limit: 1 },
  );
  if (!res.ok) return res;
  const candidate = res.data.available_phone_numbers?.[0]?.phone_number ?? null;
  return { ok: true as const, data: candidate };
}

async function createBundle(reg: RegulatoryInfo, numberType: NumberType) {
  // VERIFICAR: puede requerir RegulationSid concreto (GET /RegulatoryCompliance/Regulations
  // filtrando por IsoCountry/NumberType/EndUserType) según el número a comprar.
  return twilioNumbers<{ sid: string }>("POST", "/RegulatoryCompliance/Bundles", {
    FriendlyName: `${reg.legal_name} — ${numberType} ${reg.country_code}`,
    Email: reg.contact_email ?? undefined,
    EndUserType: reg.end_user_type,
    IsoCountry: reg.country_code,
    NumberType: numberType,
  });
}

async function assignBundleItem(bundleSid: string, objectSid: string) {
  return twilioNumbers<{ sid: string }>(
    "POST",
    `/RegulatoryCompliance/Bundles/${bundleSid}/ItemAssignments`,
    { ObjectSid: objectSid },
  );
}

async function submitBundle(bundleSid: string) {
  return twilioNumbers<{ sid: string; status: string }>(
    "POST",
    `/RegulatoryCompliance/Bundles/${bundleSid}`,
    { Status: "pending-review" },
  );
}

async function purchaseNumber(
  phoneNumber: string,
  bundleSid: string,
  addressSid: string,
) {
  return twilioCore<{ sid: string }>(
    "POST",
    `/Accounts/${twilioAccountSid()}/IncomingPhoneNumbers.json`,
    { PhoneNumber: phoneNumber, BundleSid: bundleSid, AddressSid: addressSid },
  );
}

// ---------------------------------------------------------------------------
// Orquestador
// ---------------------------------------------------------------------------

export async function provisionTwilioNumber(
  opts: ProvisionOptions,
): Promise<ProvisionResult> {
  const numberType = opts.numberType ?? "local";
  const admin = createAdminClient();

  // 1) Identidad regulatoria del cliente (End-User).
  const { data: reg, error: regErr } = await admin
    .from("clinic_regulatory_info")
    .select("*")
    .eq("clinic_id", opts.clinicId)
    .maybeSingle();
  if (regErr) {
    return { success: false, error: `No se pudo leer clinic_regulatory_info: ${regErr.message}` };
  }
  if (!reg) {
    return {
      success: false,
      error: "Falta clinic_regulatory_info para la clínica. Captúrala antes de aprovisionar.",
    };
  }

  // 2) End-User (IT…) — crear si falta.
  let endUserSid = reg.twilio_end_user_sid;
  if (!endUserSid) {
    const res = await createEndUser(reg);
    if (!res.ok) return { success: false, error: `Twilio EndUser: ${res.error}` };
    endUserSid = res.data.sid;
    const up = await admin
      .from("clinic_regulatory_info")
      .update({ twilio_end_user_sid: endUserSid })
      .eq("clinic_id", opts.clinicId);
    if (up.error) return { success: false, error: `Persistir end_user_sid: ${up.error.message}` };
  }

  // 3) Address (AD…) — crear si falta.
  let addressSid = reg.twilio_address_sid;
  if (!addressSid) {
    const res = await createAddress(reg);
    if (!res.ok) return { success: false, error: `Twilio Address: ${res.error}` };
    addressSid = res.data.sid;
    const up = await admin
      .from("clinic_regulatory_info")
      .update({ twilio_address_sid: addressSid })
      .eq("clinic_id", opts.clinicId);
    if (up.error) return { success: false, error: `Persistir address_sid: ${up.error.message}` };
  }

  // 4) Documentos de soporte (RD…) — prerequisito manual (se suben en Twilio).
  const supportingDocSids = Array.isArray(reg.supporting_document_sids)
    ? (reg.supporting_document_sids as string[])
    : [];
  if (supportingDocSids.length === 0) {
    return {
      success: false,
      stoppedAt: "regulatory_ready",
      error:
        "Faltan supporting_document_sids del End-User. Súbelos en Twilio y regístralos en clinic_regulatory_info antes de armar el bundle.",
    };
  }

  // 5) Candidato de número (búsqueda barata, sin comprar). phone_number es NOT NULL,
  //    así que necesitamos un candidato para crear la fila. Reutiliza fila pending si existe.
  let row: TelephonyNumberRow;
  const { data: existing, error: existErr } = await admin
    .from("telephony_numbers")
    .select("*")
    .eq("clinic_id", opts.clinicId)
    .eq("status", "pending_purchase")
    .limit(1)
    .maybeSingle();
  if (existErr) return { success: false, error: `Leer telephony_numbers: ${existErr.message}` };

  if (existing) {
    row = existing;
  } else {
    const candidate = await searchAvailableNumber(reg.country_code, numberType, opts.areaCode);
    if (!candidate.ok) return { success: false, error: `Búsqueda de número: ${candidate.error}` };
    if (!candidate.data) {
      return { success: false, error: "Sin números disponibles para esos criterios (país/tipo/área)." };
    }
    const ins = await admin
      .from("telephony_numbers")
      .insert({
        clinic_id: opts.clinicId,
        phone_number: candidate.data,
        provider: "twilio",
        country_code: reg.country_code,
        number_type: numberType,
        status: "pending_purchase",
        bundle_status: "draft",
        billing_model: opts.billing?.model ?? "included_in_subscription",
        provider_monthly_cost: opts.billing?.providerMonthlyCost ?? null,
        billed_monthly_price: opts.billing?.billedMonthlyPrice ?? null,
        currency: opts.billing?.currency ?? "EUR",
      })
      .select("*")
      .single();
    if (ins.error) return { success: false, error: `Crear telephony_numbers: ${ins.error.message}` };
    row = ins.data;
  }

  // 6) Bundle (BU…) draft + item assignments — crear si falta.
  let bundleSid = row.twilio_bundle_sid;
  if (!bundleSid) {
    const res = await createBundle(reg, numberType);
    if (!res.ok) return { success: false, error: `Twilio Bundle: ${res.error}` };
    bundleSid = res.data.sid;
    for (const objectSid of [endUserSid, addressSid, ...supportingDocSids]) {
      const assign = await assignBundleItem(bundleSid, objectSid);
      if (!assign.ok) {
        return { success: false, error: `Asignar item ${objectSid} al bundle: ${assign.error}` };
      }
    }
    const up = await admin
      .from("telephony_numbers")
      .update({ twilio_bundle_sid: bundleSid })
      .eq("id", row.id);
    if (up.error) return { success: false, error: `Persistir bundle_sid: ${up.error.message}` };
  }

  // ── PARADA #1: regulatory_ready. Sin confirmación no se envía el bundle ni se compra.
  if (!opts.confirmSubmitBundle) {
    return {
      success: true,
      stoppedAt: "regulatory_ready",
      numberId: row.id,
      phoneNumber: row.phone_number,
      endUserSid,
      addressSid,
      bundleSid,
      message:
        "Preparado (End-User + Address + Bundle draft). Revisa los datos y re-ejecuta con confirmSubmitBundle para ENVIAR el bundle a Twilio.",
    };
  }

  // 7) Enviar bundle (acción regulatoria) — solo con confirmSubmitBundle.
  if (row.bundle_status === "draft") {
    const res = await submitBundle(bundleSid);
    if (!res.ok) {
      return { success: false, stoppedAt: "regulatory_ready", error: `Enviar bundle: ${res.error}` };
    }
    const up = await admin
      .from("telephony_numbers")
      .update({
        bundle_status: "pending_review",
        bundle_submitted_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (up.error) return { success: false, error: `Persistir estado bundle: ${up.error.message}` };
    row.bundle_status = "pending_review";
  }

  // ── PARADA #2: esperar aprobación de Twilio. No se compra hasta 'twilio_approved'.
  if (row.bundle_status !== "twilio_approved") {
    return {
      success: true,
      stoppedAt: "bundle_submitted",
      numberId: row.id,
      phoneNumber: row.phone_number,
      bundleSid,
      message: `Bundle en estado '${row.bundle_status}'. Espera la aprobación de Twilio (un poller actualizará bundle_status) y re-ejecuta con confirmPurchase.`,
    };
  }

  // ── PARADA #3: compra (dinero, irreversible) — solo con confirmPurchase.
  if (!opts.confirmPurchase) {
    return {
      success: true,
      stoppedAt: "bundle_submitted",
      numberId: row.id,
      phoneNumber: row.phone_number,
      bundleSid,
      message: "Bundle aprobado. Re-ejecuta con confirmPurchase para COMPRAR el número (acción de pago, irreversible).",
    };
  }

  // 8) Comprar el número y registrar el SID.
  const buy = await purchaseNumber(row.phone_number, bundleSid, addressSid);
  if (!buy.ok) return { success: false, stoppedAt: "number_purchased", error: `Compra: ${buy.error}` };
  const up = await admin
    .from("telephony_numbers")
    .update({
      provider_sid: buy.data.sid,
      status: "active",
      bundle_approved_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (up.error) return { success: false, error: `Persistir compra: ${up.error.message}` };

  return {
    success: true,
    stoppedAt: "registered",
    numberId: row.id,
    phoneNumber: row.phone_number,
    endUserSid,
    addressSid,
    bundleSid,
    numberSid: buy.data.sid,
    message: "Número comprado y registrado en telephony_numbers.",
  };
}
