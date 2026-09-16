export function failedWhatsAppDeliveryMetadata(
  current: Record<string, unknown>,
  occurredAt = new Date().toISOString(),
): Record<string, unknown> {
  return {
    ...current,
    delivery_status: "failed",
    delivery_error: "El proveedor de WhatsApp no aceptó el mensaje.",
    failed_at: occurredAt,
    delivery_updated_at: occurredAt,
  };
}
