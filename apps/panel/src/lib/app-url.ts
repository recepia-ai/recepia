const FALLBACK_APP_URL = "https://recepia-panel.vercel.app";

type AppUrlEnvironment = Partial<
  Record<"NEXT_PUBLIC_APP_URL" | "VERCEL_BRANCH_URL" | "VERCEL_URL", string>
>;

function withHttps(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function getAppBaseUrl(
  environment: AppUrlEnvironment = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
    VERCEL_URL: process.env.VERCEL_URL,
  },
): string {
  const configured =
    environment.NEXT_PUBLIC_APP_URL ?? environment.VERCEL_BRANCH_URL ?? environment.VERCEL_URL;

  return configured ? withHttps(configured) : FALLBACK_APP_URL;
}
