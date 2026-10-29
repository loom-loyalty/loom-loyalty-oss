/**
 * Handoff token generation and validation
 * For secure Dashboard → Hub navigation
 */

import { SignJWT, jwtVerify } from "jose";
import { HANDOFF_TOKEN_EXPIRY_SECONDS } from "../shared/constants";
import type {
  GenerateHandoffRequest,
  GenerateHandoffResponse,
  HandoffError,
  HandoffTokenPayload,
} from "../types/handoff";
import type { SessionData } from "../types/session";

/**
 * Generate a unique token ID
 */
function generateJti(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Storage interface for single-use token enforcement
 * Implement this with Cloudflare KV, Redis, or other storage
 */
export interface HandoffTokenStore {
  /** Check if a token ID has been used */
  isUsed(jti: string): Promise<boolean>;
  /** Mark a token ID as used (should auto-expire after ~5 minutes) */
  markUsed(jti: string): Promise<void>;
}

/**
 * In-memory token store for development/testing
 * In production, use Cloudflare KV or similar
 */
export function createInMemoryTokenStore(): HandoffTokenStore {
  const usedTokens = new Map<string, number>();

  // Cleanup old tokens periodically
  setInterval(() => {
    const now = Date.now();
    for (const [jti, expiry] of usedTokens) {
      if (now > expiry) {
        usedTokens.delete(jti);
      }
    }
  }, 60000); // Cleanup every minute

  return {
    async isUsed(jti: string): Promise<boolean> {
      return usedTokens.has(jti);
    },
    async markUsed(jti: string): Promise<void> {
      // Store with expiry time (5 minutes from now)
      usedTokens.set(jti, Date.now() + HANDOFF_TOKEN_EXPIRY_SECONDS * 1000);
    },
  };
}

/**
 * Create a Cloudflare KV-based token store
 */
export function createKVTokenStore(kv: {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}): HandoffTokenStore {
  return {
    async isUsed(jti: string): Promise<boolean> {
      const value = await kv.get(`handoff:${jti}`);
      return value !== null;
    },
    async markUsed(jti: string): Promise<void> {
      await kv.put(`handoff:${jti}`, "1", {
        expirationTtl: HANDOFF_TOKEN_EXPIRY_SECONDS + 60, // Add buffer
      });
    },
  };
}

/**
 * Generate a handoff token for Dashboard → Hub navigation
 */
export async function generateHandoffToken(
  session: SessionData,
  request: GenerateHandoffRequest,
  organizationEnvironmentId: string,
  secret: string
): Promise<GenerateHandoffResponse> {
  const secretKey = new TextEncoder().encode(secret.padEnd(32, "0").slice(0, 32));
  const jti = generateJti();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + HANDOFF_TOKEN_EXPIRY_SECONDS;

  // Ensure we have required user data
  if (!session.user.externalId) {
    throw new Error("User does not have externalId (Loom user ID)");
  }
  if (!session.idpOrganizationId) {
    throw new Error("Session does not have organization context");
  }

  const payload: Omit<HandoffTokenPayload, "iat" | "exp"> = {
    sub: session.user.id,
    external_id: session.user.externalId,
    idp_org_id: session.idpOrganizationId,
    org_env_id: organizationEnvironmentId,
    target: request.targetHub,
    source_sid: session.sessionId || "",
    jti,
  };

  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(secretKey);

  // Construct redirect URL
  const redirectUrl = new URL(request.targetHub);
  redirectUrl.searchParams.set("handoff", token);

  return {
    token,
    redirectUrl: redirectUrl.toString(),
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

/**
 * Reduce a URL to its origin (scheme, host and port). Returns null for anything
 * that isn't an absolute http(s) URL, so an empty or partial value never matches.
 */
function toOrigin(value: unknown): string | null {
  if (typeof value !== "string" || value === "") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Validate and decode a handoff token.
 *
 * `expectedTarget` is the origin the caller says it is exchanging from. It must
 * equal the origin of the token's `target` exactly; a substring match would let
 * an empty or partial value pass for any token (#923).
 */
export async function validateHandoffToken(
  token: string,
  secret: string,
  tokenStore: HandoffTokenStore,
  expectedTarget: string
): Promise<{ payload: HandoffTokenPayload } | { error: HandoffError }> {
  const secretKey = new TextEncoder().encode(secret.padEnd(32, "0").slice(0, 32));

  try {
    // Verify signature and expiration
    const { payload } = await jwtVerify(token, secretKey);
    const handoffPayload = payload as unknown as HandoffTokenPayload;

    // Validate target origin: exact origin match, never a substring check
    const tokenOrigin = toOrigin(handoffPayload.target);
    const expectedOrigin = toOrigin(expectedTarget);
    if (!tokenOrigin || !expectedOrigin || tokenOrigin !== expectedOrigin) {
      return {
        error: {
          code: "INVALID_TARGET",
          message: "Token target does not match requesting origin",
        },
      };
    }

    // Check single-use
    if (await tokenStore.isUsed(handoffPayload.jti)) {
      return {
        error: {
          code: "ALREADY_USED",
          message: "Handoff token has already been used",
        },
      };
    }

    // Mark as used
    await tokenStore.markUsed(handoffPayload.jti);

    return { payload: handoffPayload };
  } catch (error) {
    // Check if it's a JWT verification error
    if (error instanceof Error) {
      if (error.message.includes("expired")) {
        return {
          error: {
            code: "EXPIRED_TOKEN",
            message: "Handoff token has expired",
          },
        };
      }
    }

    return {
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid handoff token",
      },
    };
  }
}

/**
 * Parse handoff token from URL search params
 */
export function parseHandoffFromUrl(url: string | URL): string | null {
  const urlObj = typeof url === "string" ? new URL(url) : url;
  return urlObj.searchParams.get("handoff");
}
