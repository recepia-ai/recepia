import { CheckCircle2, CircleDashed } from "lucide-react";
import { automationControlFromConfig } from "@/lib/automation-control";
import { clinicAgentConfigFromData } from "@/lib/clinic-agent-config";
import { pilotReadiness } from "@/lib/onboarding-readiness";
import { resolveOrganizationContext } from "@/lib/organization-context";
import { createClient } from "@/lib/supabase/server";

export default async function OnboardingReadinessPage() {
  const supabase = await createClient();
  const access = await resolveOrganizationContext(supabase);
  if (!access.ok) return null;
  const clinicId = access.context.organization.id;
  const [clinic, config, team, services, vets, schedules, google, channels, smokes] =
    await Promise.all([
      supabase.from("clinics").select("name, locale, timezone").eq("id", clinicId).single(),
      supabase.from("clinic_config").select("config").eq("clinic_id", clinicId).maybeSingle(),
      supabase.from("clinic_users").select("id, role").eq("clinic_id", clinicId),
      supabase.from("services").select("id").eq("clinic_id", clinicId).eq("active", true),
      supabase
        .from("clinic_users")
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("role", "veterinario"),
      supabase.from("vet_consultation_hours").select("id").eq("clinic_id", clinicId),
      supabase
        .from("clinic_integrations")
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("provider", "google_calendar")
        .maybeSingle(),
      supabase
        .from("clinic_channels")
        .select("channel_type, provider_config")
        .eq("clinic_id", clinicId),
      supabase
        .from("channel_events")
        .select("channel")
        .eq("clinic_id", clinicId)
        .eq("status", "completed")
        .limit(100),
    ]);
  if (!clinic.data) return null;
  const agent = clinicAgentConfigFromData(clinic.data, config.data?.config);
  const phone = channels.data?.find((channel) => channel.channel_type === "phone");
  const phoneConfig =
    phone?.provider_config &&
    typeof phone.provider_config === "object" &&
    !Array.isArray(phone.provider_config)
      ? phone.provider_config
      : {};
  const completedChannels = new Set((smokes.data ?? []).map((event) => event.channel));
  const control = automationControlFromConfig(config.data?.config);
  const items = pilotReadiness({
    clinicConfigured: Boolean(agent.publicName && agent.greetings.voice && !agent.recordingEnabled),
    adminCount: (team.data ?? []).filter((member) => member.role === "admin").length,
    teamCount: team.data?.length ?? 0,
    serviceCount: services.data?.length ?? 0,
    veterinarianCount: vets.data?.length ?? 0,
    scheduleCount: schedules.data?.length ?? 0,
    googleConnected: Boolean(google.data),
    whatsappConfigured: Boolean(
      channels.data?.some((channel) => channel.channel_type === "whatsapp"),
    ),
    phoneConfigured: Boolean(phone),
    transferConfigured: Boolean("transfer_number" in phoneConfig && phoneConfig.transfer_number),
    webSmoke: completedChannels.has("web"),
    whatsappSmoke: completedChannels.has("whatsapp"),
    phoneSmoke: completedChannels.has("phone"),
    channels: control,
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-stone-900">Preparación del piloto</h2>
        <p className="mt-1 text-xs text-stone-500">
          Completa la configuración y activa los canales progresivamente después de sus smokes.
        </p>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-3"
          >
            {item.ready ? (
              <CheckCircle2 className="size-4 text-emerald-600" />
            ) : (
              <CircleDashed className="size-4 text-amber-600" />
            )}
            <span className="text-sm text-stone-700">{item.label}</span>
          </div>
        ))}
      </div>
      <p className="rounded-lg bg-stone-50 p-3 text-xs text-stone-600">
        Grabación de voz OFF. Los proveedores y secretos se configuran después del provisioning;
        este checklist no activa canales automáticamente.
      </p>
    </div>
  );
}
