import type { Database } from "@recepia/db";

type JsonValue = Database["public"]["Tables"]["channel_events"]["Insert"]["payload"];

const SENSITIVE_ARTIFACT_KEYS = new Set([
  "logUrl",
  "pcapUrl",
  "presignedAssistantUrl",
  "presignedCustomerUrl",
  "presignedLogUrl",
  "presignedMonoUrl",
  "presignedStereoUrl",
  "presignedUrlsExpiresAt",
  "recording",
  "recordingUrl",
  "stereoRecordingUrl",
  "videoRecordingUrl",
]);

const SENSITIVE_VAPI_KEYS = new Set([
  "callToken",
  "controlUrl",
  "logUrl",
  "pcapUrl",
  "presignedAssistantUrl",
  "presignedCustomerUrl",
  "presignedLogUrl",
  "presignedMonoUrl",
  "presignedStereoUrl",
  "presignedUrlsExpiresAt",
  "recording",
  "recordingUrl",
  "secret",
  "stereoRecordingUrl",
  "twilioAuthToken",
  "videoRecordingUrl",
]);

const SENSITIVE_HEADER_KEYS = new Set([
  "authorization",
  "x-vapi-secret",
  "x-vercel-protection-bypass",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isSensitiveUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const queryKeys = new Set([...url.searchParams.keys()].map((key) => key.toLowerCase()));
    return (
      queryKeys.has("x-vercel-protection-bypass") ||
      queryKeys.has("x-amz-credential") ||
      queryKeys.has("x-amz-signature")
    );
  } catch {
    return false;
  }
}

function redactSensitiveVapiValues(value: unknown): void {
  const current = record(value);
  if (!current) return;

  for (const [key, child] of Object.entries(current)) {
    if (
      SENSITIVE_VAPI_KEYS.has(key) ||
      SENSITIVE_HEADER_KEYS.has(key.toLowerCase()) ||
      (typeof child === "string" && isSensitiveUrl(child))
    ) {
      delete current[key];
      continue;
    }

    if (Array.isArray(child)) {
      for (const entry of child) redactSensitiveVapiValues(entry);
    } else {
      redactSensitiveVapiValues(child);
    }
  }
}

/**
 * Removes provider artifact URLs before webhook evidence is persisted.
 * The Vapi call ID remains the durable server-side reference for any future
 * authenticated retrieval; bearer/presigned URLs are deliberately not kept.
 */
export function redactVapiArtifactReferences(payload: unknown): JsonValue {
  const cloned = JSON.parse(JSON.stringify(payload)) as JsonValue;
  const root = record(cloned);
  const message = record(root?.message);
  const artifact = record(message?.artifact);
  if (artifact) {
    for (const key of SENSITIVE_ARTIFACT_KEYS) delete artifact[key];
  }
  redactSensitiveVapiValues(cloned);
  return cloned;
}
