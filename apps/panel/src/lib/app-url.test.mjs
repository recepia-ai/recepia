import assert from "node:assert/strict";
import test from "node:test";
import { getAppBaseUrl } from "./app-url.ts";

test("prefers an explicitly configured application URL", () => {
  assert.equal(
    getAppBaseUrl({
      NEXT_PUBLIC_APP_URL: "https://preview.recepia.example/",
      VERCEL_BRANCH_URL: "branch.vercel.app",
    }),
    "https://preview.recepia.example",
  );
});

test("uses the stable Vercel branch URL before the deployment URL", () => {
  assert.equal(
    getAppBaseUrl({
      VERCEL_BRANCH_URL: "recepia-panel-git-demo.vercel.app",
      VERCEL_URL: "recepia-panel-hash.vercel.app",
    }),
    "https://recepia-panel-git-demo.vercel.app",
  );
});

test("adds HTTPS to Vercel hostnames", () => {
  assert.equal(
    getAppBaseUrl({ VERCEL_URL: "recepia-panel-hash.vercel.app" }),
    "https://recepia-panel-hash.vercel.app",
  );
});
