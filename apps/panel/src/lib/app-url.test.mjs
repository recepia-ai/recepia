import assert from "node:assert/strict";
import test from "node:test";
import { getAppBaseUrl, getAuthCallbackUrl } from "./app-url.ts";

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

test("falls back to the local application in non-Vercel development", () => {
  assert.equal(getAppBaseUrl({}), "http://localhost:3000");
});

test("keeps local development local even when pulled Vercel variables exist", () => {
  assert.equal(
    getAppBaseUrl({ NODE_ENV: "development", VERCEL_URL: "recepia-panel-hash.vercel.app" }),
    "http://localhost:3000",
  );
});

test("builds the environment-specific Supabase callback URL", () => {
  assert.equal(
    getAuthCallbackUrl({ VERCEL_BRANCH_URL: "recepia-panel-git-demo.vercel.app" }),
    "https://recepia-panel-git-demo.vercel.app/auth/callback?next=/",
  );
});
