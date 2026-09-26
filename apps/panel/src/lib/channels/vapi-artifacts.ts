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

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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
  if (!artifact) return cloned;

  for (const key of SENSITIVE_ARTIFACT_KEYS) delete artifact[key];
  return cloned;
}
