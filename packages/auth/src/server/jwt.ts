/**
 * JWT utilities for WorkOS token validation
 * Uses jose library for edge runtime compatibility
 */

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { WORKOS_JWKS_URL } from "../shared/constants";
import type { AuthUser, WorkOSJWTClaims } from "../types/session";

// Cache JWKS resolvers per WorkOS client so multiple WorkOS environments can
// verify tokens in the same Worker process.
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/**
 * Get or create JWKS for token verification
 */
function getJWKS(clientId: string) {
  let jwks = jwksCache.get(clientId);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(WORKOS_JWKS_URL(clientId)));
    jwksCache.set(clientId, jwks);
  }
  return jwks;
}

/**
 * Clear JWKS cache (useful for testing or key rotation)
 */
export function clearJWKSCache() {
  jwksCache.clear();
}

/**
 * Verify and decode a WorkOS access token
 */
export async function verifyAccessToken(token: string, clientId: string): Promise<WorkOSJWTClaims> {
  const jwks = getJWKS(clientId);

  const { payload } = await jwtVerify(token, jwks, {
    issuer: "https://api.workos.com/",
    audience: clientId,
  });

  return payload as unknown as WorkOSJWTClaims;
}

/**
 * Convert base64url to base64 for decoding
 * JWTs use base64url encoding (RFC 7519) which differs from standard base64
 */
function base64urlToBase64(base64url: string): string {
  // Replace base64url characters with base64 equivalents
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding if needed
  const padding = base64.length % 4;
  if (padding) {
    base64 += "=".repeat(4 - padding);
  }
  return base64;
}

/**
 * Decode a JWT without verification (for reading claims)
 * Use only when you've already verified the token or for non-sensitive reads
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payloadPart = parts[1];
    if (!payloadPart) return null;

    const payload = JSON.parse(atob(base64urlToBase64(payloadPart)));
    return payload;
  } catch {
    return null;
  }
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(token: string, bufferSeconds: number = 30): boolean {
  const payload = decodeToken(token);
  if (!payload || typeof payload.exp !== "number") return true;

  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now + bufferSeconds;
}

/**
 * Extract user information from WorkOS JWT claims
 */
export function extractUserFromClaims(claims: WorkOSJWTClaims): Partial<AuthUser> {
  return {
    id: claims.sub,
  };
}

/**
 * Extract organization ID from WorkOS JWT claims
 */
export function extractOrgIdFromClaims(claims: WorkOSJWTClaims): string | undefined {
  return claims.org_id;
}

/**
 * Extract session ID from WorkOS JWT claims
 */
export function extractSessionIdFromClaims(claims: WorkOSJWTClaims): string {
  return claims.sid;
}

/**
 * Extract external ID (Loom user ID) from WorkOS JWT claims
 */
export function extractExternalIdFromClaims(claims: WorkOSJWTClaims): string | undefined {
  return claims.user_external_id;
}

/**
 * Extract timezone from WorkOS JWT claims
 */
export function extractTimezoneFromClaims(claims: WorkOSJWTClaims): string | undefined {
  return claims.user_timezone;
}

/**
 * Extract language from WorkOS JWT claims
 */
export function extractLanguageFromClaims(claims: WorkOSJWTClaims): string | undefined {
  return claims.user_language;
}
