/**
 * Slack install-state issuer (dashboard side).
 *
 * Mints the signed, single-use `state` that carries an install's tenant binding
 * from the dashboard (which authenticated the admin) to the ai-server OAuth
 * callback. This is the production SIGNER; the ai-server holds the canonical
 * VERIFIER (`apps/ai-server/src/integrations/slack/install-state.ts`
 * `verifyInstallState`). The two MUST stay in lock-step: same claim set, HS256,
 * and the SAME key derivation.
 *
 * Key derivation is SHA-256(secret) — a full-entropy, fixed 32 bytes via Web
 * Crypto (the dashboard runs on Cloudflare Workers; `node:crypto` is
 * unavailable). We deliberately do NOT reuse `handoff.ts`'s
 * `secret.padEnd(32,"0").slice(0,32)`, which null-pads a short secret (weak key)
 * and silently truncates a long one (drops entropy) — and would NOT match the
 * ai-server verifier.
 *
 * Single-use is enforced on the ai-server side (it consumes the `jti` exactly
 * once via its idempotency store), so this signer is stateless — it just mints a
 * fresh random `jti` per call.
 */
import { SignJWT } from "jose";

export interface SlackInstallStateClaims {
  loomOrgId: string;
  loomEnvId: string;
  workosUserId: string;
  /** The bound environment's WorkOS organization id (`idpOrganizationId`) — the
   *  id WorkOS membership queries are keyed by. Distinct from `loomOrgId` (the
   *  platform org id used for the SDK bot-key mint); the operator-role gates need
   *  this one. */
  idpOrganizationId: string;
  /** The dashboard page the ai-server returns the installer to after Slack's
   *  OAuth callback, so the ai-server needs no dashboard URL of its own. */
  dashboardUrl: string;
}

const DEFAULT_TTL_SECONDS = 300;

/** SHA-256(secret) → 32 raw bytes. Web Crypto (Workers). MUST match the
 *  ai-server verifier's derivation exactly. */
async function deriveKey(secret: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return new Uint8Array(digest);
}

/** A fresh single-use id (the ai-server consumes it once). */
function generateJti(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Sign a single-use Slack install state (HS256, SHA-256-derived key). Carries
 * the verified `{ loomOrgId, loomEnvId, workosUserId, idpOrganizationId }`, the
 * signing dashboard's own `dashboardUrl`, a
 * random `jti` and a short TTL (default 5 minutes). The caller must have resolved
 * org/env from verified membership claims — this signer trusts what it is given.
 */
export async function generateSlackInstallState(
  claims: SlackInstallStateClaims,
  secret: string,
  opts?: { ttlSeconds?: number }
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const ttl = opts?.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const key = await deriveKey(secret);
  return new SignJWT({
    loomOrgId: claims.loomOrgId,
    loomEnvId: claims.loomEnvId,
    workosUserId: claims.workosUserId,
    idpOrganizationId: claims.idpOrganizationId,
    dashboardUrl: claims.dashboardUrl,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(generateJti())
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(key);
}
