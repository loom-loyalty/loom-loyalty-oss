/**
 * Session management with encrypted cookies
 * Compatible with Cloudflare Workers (uses Web Crypto API)
 */

import { EncryptJWT, jwtDecrypt, type JWTPayload } from "jose";
import {
  DEFAULT_ACCESS_TOKEN_DURATION,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from "../shared/constants";
import type { AuthUser, SessionData, WorkOSJWTClaims } from "../types/session";
import {
  decodeToken,
  extractExternalIdFromClaims,
  extractOrgIdFromClaims,
  extractSessionIdFromClaims,
} from "./jwt";

/**
 * Derive an encryption key from a secret string
 * Uses PBKDF2 for key derivation
 */
async function deriveKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("loom-loyalty-session"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Cache derived key per secret
const _keyCache = new Map<string, CryptoKey>();

async function _getKey(secret: string): Promise<CryptoKey> {
  let key = _keyCache.get(secret);
  if (!key) {
    key = await deriveKey(secret);
    _keyCache.set(secret, key);
  }
  return key;
}

// Re-export for potential future use
export { _getKey as getDerivedKey };

/**
 * Encrypt session data into a sealed JWT
 */
export async function sealSession<T extends object>(session: T, secret: string): Promise<string> {
  const secretKey = new TextEncoder().encode(secret.padEnd(32, "0").slice(0, 32));

  const jwt = await new EncryptJWT(session as unknown as JWTPayload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .encrypt(secretKey);

  return jwt;
}

/**
 * Decrypt a sealed session JWT
 */
export async function unsealSession<T = SessionData>(
  sealed: string,
  secret: string
): Promise<T | null> {
  try {
    const secretKey = new TextEncoder().encode(secret.padEnd(32, "0").slice(0, 32));

    const { payload } = await jwtDecrypt(sealed, secretKey);

    return payload as unknown as T;
  } catch {
    return null;
  }
}

/**
 * Create a session cookie header value
 */
export function createSessionCookie(
  sealedSession: string,
  cookieName: string = SESSION_COOKIE_NAME
): string {
  const options = SESSION_COOKIE_OPTIONS;
  const parts = [
    `${cookieName}=${sealedSession}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAge}`,
    `SameSite=${options.sameSite}`,
  ];

  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");

  return parts.join("; ");
}

/**
 * Create a cookie header to clear the session
 */
export function createClearSessionCookie(cookieName: string = SESSION_COOKIE_NAME): string {
  const options = SESSION_COOKIE_OPTIONS;
  const parts = [
    `${cookieName}=`,
    `Path=${options.path}`,
    "Max-Age=0",
    `SameSite=${options.sameSite}`,
  ];

  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");

  return parts.join("; ");
}

/**
 * Parse session cookie from request headers
 */
export function parseSessionCookie(
  cookieHeader: string | null,
  cookieName: string = SESSION_COOKIE_NAME
): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const sessionCookie = cookies.find((c) => c.startsWith(`${cookieName}=`));

  if (!sessionCookie) return null;

  return sessionCookie.slice(cookieName.length + 1);
}

/**
 * Get session from request
 */
export async function getSessionFromRequest(
  request: Request,
  secret: string
): Promise<SessionData | null> {
  const cookieHeader = request.headers.get("Cookie");
  const sealed = parseSessionCookie(cookieHeader);

  if (!sealed) return null;

  return unsealSession(sealed, secret);
}

/**
 * Create a new session data object
 */
export function createSessionData(params: {
  accessToken: string;
  refreshToken: string;
  user: SessionData["user"];
  idpOrganizationId?: string;
  sessionId?: string;
  accessTokenExpiresAt: number;
}): SessionData {
  const now = Date.now();
  return {
    ...params,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update session with new tokens
 */
export function updateSessionTokens(
  session: SessionData,
  accessToken: string,
  refreshToken: string,
  accessTokenExpiresAt: number
): SessionData {
  return {
    ...session,
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
    updatedAt: Date.now(),
  };
}

/**
 * Build a new SessionData from a token refresh result.
 * Decodes the new JWT to extract claims (externalId, orgId, sessionId, exp).
 *
 * Shared by the BFF proxy and the auth refresh endpoint to avoid duplicating
 * the claim-extraction logic.
 */
export function buildSessionFromRefresh(refreshResult: {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  organizationId?: string;
}): SessionData {
  const claims = decodeToken(refreshResult.accessToken) as WorkOSJWTClaims | null;
  const externalId = claims ? extractExternalIdFromClaims(claims) : undefined;

  return createSessionData({
    accessToken: refreshResult.accessToken,
    refreshToken: refreshResult.refreshToken,
    user: {
      ...refreshResult.user,
      externalId,
    },
    idpOrganizationId:
      refreshResult.organizationId || (claims ? extractOrgIdFromClaims(claims) : undefined),
    sessionId: claims ? extractSessionIdFromClaims(claims) : undefined,
    accessTokenExpiresAt:
      claims?.exp ?? Math.floor(Date.now() / 1000) + DEFAULT_ACCESS_TOKEN_DURATION,
  });
}
