/**
 * Client-safe JWT utilities.
 * No node-only dependencies — safe for browser and server.
 */

/**
 * Decode a JWT payload without verification.
 * Use for reading claims client-side; verification happens server-side.
 */
export function decodeJwtPayload<T = Record<string, unknown>>(token: string): T | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1]!;
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

/**
 * Check if a JWT is expired (with optional buffer).
 * Returns true if expired or unparseable.
 */
export function isJwtExpired(token: string, bufferSeconds = 30): boolean {
  const payload = decodeJwtPayload<{ exp?: number }>(token);
  if (!payload?.exp) return true;
  return payload.exp < Math.floor(Date.now() / 1000) + bufferSeconds;
}
