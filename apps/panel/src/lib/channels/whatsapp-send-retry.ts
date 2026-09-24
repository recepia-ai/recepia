export function shouldRetryWhatsAppHttpFailure(status: number, attempt: number): boolean {
  return attempt < 3 && (status === 429 || status >= 500);
}

/** A network timeout has unknown acceptance and must not be replayed blindly. */
export function shouldRetryWhatsAppNetworkFailure(): boolean {
  return false;
}
