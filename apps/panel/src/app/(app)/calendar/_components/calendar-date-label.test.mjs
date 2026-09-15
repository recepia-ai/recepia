import assert from "node:assert/strict";
import test from "node:test";
import { formatCalendarAriaDate } from "./calendar-date-label.ts";

test("formats calendar aria dates deterministically as day/month/year", () => {
  assert.equal(formatCalendarAriaDate(new Date(2026, 8, 16, 8)), "16/9/2026");
});
