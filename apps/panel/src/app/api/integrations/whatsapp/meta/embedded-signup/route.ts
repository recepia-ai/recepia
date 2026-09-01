import { NextResponse } from "next/server";
import { z } from "zod";
import {
  completeMetaEmbeddedSignup,
  MetaEmbeddedSignupError,
} from "@/lib/channels/meta-embedded-signup";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const requestSchema = z.object({
  code: z.string().trim().min(20).max(4096),
  wabaId: z.string().regex(/^\d+$/),
  phoneNumberId: z.string().regex(/^\d+$/).optional(),
  businessId: z.string().regex(/^\d+$/).optional(),
  onboarding: z.enum(["coexistence", "cloud_api"]),
});

function normalizedPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: clinicUser } = await supabase
    .from("clinic_users")
    .select("clinic_id, role")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!clinicUser || clinicUser.role !== "admin") {
    return NextResponse.json(
      { error: "Solo un administrador puede conectar WhatsApp" },
      { status: 403 },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Respuesta de Meta incompleta" }, { status: 400 });
  }

  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const appSecret = process.env.META_WHATSAPP_APP_SECRET;
  if (!appId || !appSecret) {
    console.error("[meta embedded signup] Missing Meta app configuration");
    return NextResponse.json(
      { error: "La conexión con Meta aún no está configurada en Recepia" },
      { status: 503 },
    );
  }

  try {
    const result = await completeMetaEmbeddedSignup({
      appId,
      appSecret,
      code: parsed.data.code,
      wabaId: parsed.data.wabaId,
      phoneNumberId: parsed.data.phoneNumberId,
      coexistence: parsed.data.onboarding === "coexistence",
    });
    const identifier = normalizedPhone(result.phone.display_phone_number);
    if (!identifier) {
      throw new MetaEmbeddedSignupError(
        "phone: Meta no devolvió el número conectado",
        "phone",
      );
    }

    const admin = createAdminClient();
    const { data: current, error: currentError } = await admin
      .from("clinic_channels")
      .select("id, vault_secret_id")
      .eq("clinic_id", clinicUser.clinic_id)
      .eq("channel_type", "whatsapp")
      .eq("provider", "meta_cloud")
      .maybeSingle();
    if (currentError) throw currentError;

    const secret = JSON.stringify({
      access_token: result.accessToken,
      registration_pin: result.registrationPin,
    });
    const vaultName = `meta_cloud_clinic_${clinicUser.clinic_id}`;
    const vaultDescription = `Meta business token and registration PIN — clinic ${clinicUser.clinic_id}`;
    let vaultSecretId = current?.vault_secret_id ?? null;

    if (vaultSecretId) {
      const { error } = await admin.rpc("vault_update_secret", {
        p_id: vaultSecretId,
        p_secret: secret,
        p_name: vaultName,
        p_description: vaultDescription,
      });
      if (error) throw error;
    } else {
      const { data, error } = await admin.rpc("vault_create_secret", {
        p_secret: secret,
        p_name: vaultName,
        p_description: vaultDescription,
      });
      if (error || !data) throw error ?? new Error("Vault no devolvió un identificador");
      vaultSecretId = data as string;
    }

    const values = {
      clinic_id: clinicUser.clinic_id,
      channel_type: "whatsapp" as const,
      provider: "meta_cloud",
      identifier,
      provider_config: {
        phone_number_id: result.phoneNumberId,
        waba_id: parsed.data.wabaId,
        business_id: parsed.data.businessId ?? null,
        graph_api_version: result.graphApiVersion,
        verified_name: result.phone.verified_name ?? null,
        phone_status: result.phone.status ?? null,
        quality_rating: result.phone.quality_rating ?? null,
        onboarding:
          parsed.data.onboarding === "coexistence"
            ? "embedded_signup_v4_coexistence"
            : "embedded_signup_v4",
        token_expires_at: result.tokenExpiresAt,
      },
      vault_secret_id: vaultSecretId,
      status: "active" as const,
    };

    const { data: saved, error: saveError } = current
      ? await admin
          .from("clinic_channels")
          .update(values)
          .eq("id", current.id)
          .select("id")
          .single()
      : await admin.from("clinic_channels").insert(values).select("id").single();
    if (saveError) throw saveError;

    const { error: pauseError } = await admin
      .from("clinic_channels")
      .update({ status: "paused" })
      .eq("clinic_id", clinicUser.clinic_id)
      .eq("channel_type", "whatsapp")
      .neq("id", saved.id);
    if (pauseError) throw pauseError;

    return NextResponse.json({
      success: true,
      identifier,
      verifiedName: result.phone.verified_name ?? null,
    });
  } catch (error) {
    if (error instanceof MetaEmbeddedSignupError) {
      console.error("[meta embedded signup]", {
        step: error.step,
        status: error.status,
        message: error.message,
      });
      return NextResponse.json(
        { error: `Meta no pudo completar el paso «${error.step}». Reintenta la conexión.` },
        { status: 502 },
      );
    }
    console.error("[meta embedded signup] Could not persist channel", error);
    return NextResponse.json(
      { error: "Meta terminó el alta, pero Recepia no pudo guardar el canal" },
      { status: 500 },
    );
  }
}
