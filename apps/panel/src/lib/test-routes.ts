type RuntimeEnvironment = Partial<Record<"NODE_ENV" | "VERCEL", string>>;

export function isLegacyTestAgentApiEnabled(
  environment: RuntimeEnvironment = process.env,
): boolean {
  return environment.NODE_ENV === "development" && environment.VERCEL !== "1";
}
