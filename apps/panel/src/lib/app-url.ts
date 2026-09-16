const LOCAL_APP_URL = "http://localhost:3000";

type AppUrlEnvironment = Partial<
  Record<"NEXT_PUBLIC_APP_URL" | "NODE_ENV" | "VERCEL_BRANCH_URL" | "VERCEL_URL", string>
>;

function withHttps(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function getAppBaseUrl(
  environment: AppUrlEnvironment = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
    VERCEL_URL: process.env.VERCEL_URL,
  },
): string {
  if (environment.NEXT_PUBLIC_APP_URL) return withHttps(environment.NEXT_PUBLIC_APP_URL);
  if (environment.NODE_ENV === "development") return LOCAL_APP_URL;

  const configured = environment.VERCEL_BRANCH_URL ?? environment.VERCEL_URL;

  return configured ? withHttps(configured) : LOCAL_APP_URL;
}

export function getAuthCallbackUrl(environment?: AppUrlEnvironment): string {
  return `${getAppBaseUrl(environment)}/auth/callback?next=/`;
}
