import assert from "node:assert/strict";
import test from "node:test";
import { channelEventClaimAction } from "./channel-event-retry.ts";

test("completed and in-flight webhook replays reuse canonical evidence", () => {
  assert.equal(channelEventClaimAction("completed"), "reuse");
  assert.equal(channelEventClaimAction("processing"), "reuse");
});

test("a failed webhook may be reclaimed for a safe retry", () => {
  assert.equal(channelEventClaimAction("failed"), "retry");
});
