import assert from "node:assert/strict";
import test from "node:test";
import { isLegacyTestAgentApiEnabled } from "./test-routes.ts";

test("allows the legacy endpoint only in local development", () => {
  assert.equal(isLegacyTestAgentApiEnabled({ NODE_ENV: "development" }), true);
  assert.equal(isLegacyTestAgentApiEnabled({ NODE_ENV: "production" }), false);
  assert.equal(isLegacyTestAgentApiEnabled({ NODE_ENV: "development", VERCEL: "1" }), false);
});
