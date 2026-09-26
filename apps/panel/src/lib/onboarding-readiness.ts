export type PilotReadinessInput = {
  clinicConfigured: boolean;
  adminCount: number;
  teamCount: number;
  serviceCount: number;
  veterinarianCount: number;
  scheduleCount: number;
  googleConnected: boolean;
  whatsappConfigured: boolean;
  phoneConfigured: boolean;
  transferConfigured: boolean;
  webSmoke: boolean;
  whatsappSmoke: boolean;
  phoneSmoke: boolean;
  channels: { web: boolean; whatsapp: boolean; phone: boolean };
};

export function pilotReadiness(input: PilotReadinessInput) {
  return [
    { key: "clinic", label: "Clínica y configuración del agente", ready: input.clinicConfigured },
    { key: "admin", label: "Administrador inicial", ready: input.adminCount > 0 },
    { key: "team", label: "Equipo", ready: input.teamCount > 0 },
    { key: "services", label: "Servicios", ready: input.serviceCount > 0 },
    { key: "vets", label: "Veterinarios", ready: input.veterinarianCount > 0 },
    { key: "schedules", label: "Horarios", ready: input.scheduleCount > 0 },
    { key: "google", label: "Google Calendar", ready: input.googleConnected },
    { key: "whatsapp", label: "WhatsApp configurado", ready: input.whatsappConfigured },
    { key: "phone", label: "Voz configurada", ready: input.phoneConfigured },
    { key: "transfer", label: "Teléfono de transferencia", ready: input.transferConfigured },
    { key: "web_smoke", label: "Smoke Web", ready: input.webSmoke },
    { key: "whatsapp_smoke", label: "Smoke WhatsApp", ready: input.whatsappSmoke },
    { key: "phone_smoke", label: "Smoke Voz", ready: input.phoneSmoke },
    {
      key: "progressive_activation",
      label: "Activación progresiva (Web → WhatsApp → Voz)",
      ready: input.channels.web && input.channels.whatsapp && input.channels.phone,
    },
  ];
}
