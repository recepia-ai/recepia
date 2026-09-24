import assert from "node:assert/strict";
import test from "node:test";
import { failedWhatsAppDeliveryMetadata } from "./whatsapp-delivery.ts";

test("preserves existing message metadata on a synchronous send failure", () => {
  assert.deepEqual(failedWhatsAppDeliveryMetadata({ source: "operator" }, "2026-09-16T10:00:00Z"), {
    source: "operator",
    delivery_status: "failed",
    delivery_error: "El proveedor de WhatsApp no confirmó la aceptación del mensaje.",
    failed_at: "2026-09-16T10:00:00Z",
    delivery_updated_at: "2026-09-16T10:00:00Z",
  });
});
