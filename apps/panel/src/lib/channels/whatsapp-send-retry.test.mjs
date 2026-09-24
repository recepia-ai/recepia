import assert from "node:assert/strict";
import test from "node:test";
import {
  shouldRetryWhatsAppHttpFailure,
  shouldRetryWhatsAppNetworkFailure,
} from "./whatsapp-send-retry.ts";

test("retries explicit transient provider rejections with a bounded attempt count", () => {
  assert.equal(shouldRetryWhatsAppHttpFailure(429, 1), true);
  assert.equal(shouldRetryWhatsAppHttpFailure(503, 2), true);
  assert.equal(shouldRetryWhatsAppHttpFailure(503, 3), false);
  assert.equal(shouldRetryWhatsAppHttpFailure(400, 1), false);
});

test("does not blindly retry a network timeout with unknown provider acceptance", () => {
  assert.equal(shouldRetryWhatsAppNetworkFailure(), false);
});
