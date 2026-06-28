// ---------------------------------------------------------------------------
// Settings → Integrations — shared types and states
// ---------------------------------------------------------------------------

/** Status returned to the UI — never exposes tokens. */
export type IntegrationStatus = {
  connected: boolean;
  email?: string;
  connectedAt?: string;
};

/** Full integration row (server-internal, not sent to client). */
export type IntegrationRow = {
  id: string;
  clinic_id: string;
  vault_secret_id: string;
  provider: string;
  external_account_email: string | null;
  token_expires_at: string | null;
  scope: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

// Server Action return states
export type IntegrationActionState = {
  success?: boolean;
  error?: string;
  /** If the action should trigger a client-side redirect (OAuth URL). */
  redirectUrl?: string;
};
