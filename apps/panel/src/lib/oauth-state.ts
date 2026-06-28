import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// OAuth CSRF state token — HMAC-signed UUID + clinic_id
// ---------------------------------------------------------------------------
// Google OAuth redirects back with the state we sent. To prevent CSRF (an
// attacker initiating the flow and capturing the callback), we sign the
// state with HMAC-SHA256 using OAUTH_STATE_SECRET, which only our server
// knows. The state format is: uuid.clinic_id.hmac_hex.
// ---------------------------------------------------------------------------

function getSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) {
    throw new Error("OAUTH_STATE_SECRET environment variable is not set");
  }
  return secret;
}

/**
 * Generate a signed OAuth state for a given clinic_id.
 * Format: `uuid.clinic_id.hmac` where hmac = SHA256(uuid.clinic_id, secret).
 */
export function generateState(clinicId: string): string {
  const secret = getSecret();
  const uuid = randomUUID();
  const payload = `${uuid}.${clinicId}`;
  const hmac = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${hmac}`;
}

/**
 * Verify an OAuth state token and extract the clinic_id.
 * Returns clinic_id if valid, null if tampered or malformed.
 *
 * The state format is: uuid.clinic_id.hmac
 * Since clinic_id is a UUID (no dots inside the value), we split on "." and
 * take the last segment as the HMAC and everything before it as the payload.
 */
export function verifyState(state: string): string | null {
  const secret = getSecret();

  // Format: at least 3 segments separated by dots: uuid + clinic_id + hmac
  const lastDot = state.lastIndexOf(".");
  if (lastDot < 0) return null;

  const receivedHmac = state.slice(lastDot + 1);
  const payload = state.slice(0, lastDot);

  const expectedHmac = createHmac("sha256", secret).update(payload).digest("hex");

  // Constant-time comparison
  try {
    const a = Buffer.from(receivedHmac, "hex");
    const b = Buffer.from(expectedHmac, "hex");
    if (a.length !== b.length) return null;
    if (!timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  // Extract clinic_id: payload is uuid.clinic_id (both UUIDs, no dots inside)
  const dotIdx = payload.indexOf(".");
  if (dotIdx < 0) return null;
  const clinicId = payload.slice(dotIdx + 1);

  // Validate it looks like a UUID
  const uuidRe =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRe.test(clinicId)) return null;

  return clinicId;
}
