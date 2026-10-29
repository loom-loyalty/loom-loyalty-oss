/**
 * Classifies a CLI credential as either a WorkOS session JWT (interactive browser
 * login) or an `llk_`-prefixed M2M API key (non-interactive/CI use, e.g. a seeded
 * system key). M2M keys are opaque and validated server-side, not client-decodable,
 * so they're trusted as-is here — the backend is the real authority.
 */

const M2M_KEY_PREFIX = "llk_";

export type TokenClassification =
  | { kind: "m2m" }
  | { kind: "jwt"; expired: boolean }
  | { kind: "unknown" };

export function classifyToken(rawToken: string): TokenClassification {
  // A token sourced from a CI secret can carry a trailing newline.
  const token = rawToken.trim();

  if (token.startsWith(M2M_KEY_PREFIX) && token.length > M2M_KEY_PREFIX.length) {
    return { kind: "m2m" };
  }

  try {
    // JWT format: header.payload.signature
    const parts = token.split(".");
    if (parts.length !== 3) return { kind: "unknown" };

    // Decode payload (base64url)
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf-8"));

    // Check expiration (exp is in seconds, Date.now() is in milliseconds)
    if (payload.exp && typeof payload.exp === "number") {
      const now = Math.floor(Date.now() / 1000);
      return { kind: "jwt", expired: payload.exp < now };
    }

    // No expiration claim, assume not expired
    return { kind: "jwt", expired: false };
  } catch (error) {
    if (process.env.DEBUG) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[DEBUG] JWT parsing failed: ${message}`);
    }
    return { kind: "unknown" };
  }
}

/**
 * Check if a token is expired or invalid.
 * Returns true for expired JWTs and for unrecognized token shapes; false for
 * unexpired JWTs and `llk_` M2M keys.
 */
export function isTokenExpired(token: string): boolean {
  const classification = classifyToken(token);
  if (classification.kind === "m2m") return false;
  if (classification.kind === "jwt") return classification.expired;
  return true;
}
