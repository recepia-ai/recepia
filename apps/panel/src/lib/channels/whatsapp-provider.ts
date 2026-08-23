import type { SendResult } from "@recepia/core";
import { send360DialogText } from "@/lib/channels/whatsapp-360dialog";
import type { AdminClient, ChannelRow } from "@/lib/channels/whatsapp-cloud";
import { sendEvolutionText } from "@/lib/channels/whatsapp-evolution";
import { sendMetaWhatsAppText } from "@/lib/channels/whatsapp-meta";

export async function resolveClinicWhatsAppChannel(
  supabaseAdmin: AdminClient,
  clinicId: string,
): Promise<ChannelRow> {
  const { data, error } = await supabaseAdmin
    .from("clinic_channels")
    .select("*")
    .eq("clinic_id", clinicId)
    .eq("channel_type", "whatsapp")
    .eq("status", "active")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`No se pudo localizar el canal de WhatsApp: ${error.message}`);
  if (!data?.length) throw new Error("No hay un canal de WhatsApp activo para esta clínica");
  if (data.length > 1) {
    throw new Error("Hay más de un canal de WhatsApp activo; pausa uno antes de enviar");
  }
  const channel = data[0];
  if (!channel) throw new Error("No hay un canal de WhatsApp activo para esta clínica");
  return channel;
}

export function sendWhatsAppText(
  supabaseAdmin: AdminClient,
  channel: ChannelRow,
  recipient: string,
  text: string,
): Promise<SendResult> {
  if (channel.provider === "360dialog") {
    return send360DialogText(supabaseAdmin, channel, recipient, text);
  }
  if (channel.provider === "meta_cloud") {
    return sendMetaWhatsAppText(supabaseAdmin, channel, recipient, text);
  }
  if (channel.provider === "evolution") {
    return sendEvolutionText(supabaseAdmin, channel, recipient, text);
  }
  throw new Error(`Proveedor de WhatsApp no soportado: ${channel.provider}`);
}
