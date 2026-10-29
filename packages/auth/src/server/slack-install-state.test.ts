import { jwtVerify } from "jose";
import { describe, expect, it } from "vitest";
import { generateSlackInstallState } from "./slack-install-state";

const SECRET = "test-install-state-secret-please-rotate";
const CLAIMS = {
  loomOrgId: "org_1",
  loomEnvId: "env_1",
  workosUserId: "user_1",
  idpOrganizationId: "idporg_1",
  dashboardUrl: "https://dashboard.example.com/organization/integrations",
};

// Self-check: verify via a LOCAL replica of the ai-server's key derivation
// (SHA-256) + HS256 pin, proving this signer's output is well-formed. The
// AUTHORITATIVE cross-runtime contract test — a real token from THIS signer
// verified by the ai-server's actual `verifyInstallState` — lives in
// apps/ai-server/src/__tests__/integrations/slack/install-state.test.ts.
async function deriveKey(secret: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return new Uint8Array(digest);
}

describe("generateSlackInstallState", () => {
  it("signs an HS256 token that verifies under the SHA-256-derived key (ai-server contract)", async () => {
    const state = await generateSlackInstallState(CLAIMS, SECRET);
    const { payload, protectedHeader } = await jwtVerify(state, await deriveKey(SECRET), {
      algorithms: ["HS256"],
    });
    expect(protectedHeader.alg).toBe("HS256");
    expect(payload.loomOrgId).toBe("org_1");
    expect(payload.loomEnvId).toBe("env_1");
    expect(payload.workosUserId).toBe("user_1");
    expect(payload.idpOrganizationId).toBe("idporg_1");
    expect(payload.dashboardUrl).toBe("https://dashboard.example.com/organization/integrations");
    expect(typeof payload.jti).toBe("string");
    expect(payload.exp).toBeGreaterThan(payload.iat as number);
  });

  it("derives the key via SHA-256, not padEnd/slice truncation", async () => {
    // A long secret's tail must matter: a 32-char prefix must NOT verify a token
    // signed with the full secret (the old padEnd(32).slice(0,32) would alias).
    const longSecret = "x".repeat(40) + "TAIL_ENTROPY_THAT_MUST_COUNT";
    const state = await generateSlackInstallState(CLAIMS, longSecret);
    await expect(
      jwtVerify(state, await deriveKey(longSecret.slice(0, 32)), { algorithms: ["HS256"] })
    ).rejects.toThrow();
  });

  it("assigns a distinct jti per call", async () => {
    const a = await jwtVerify(
      await generateSlackInstallState(CLAIMS, SECRET),
      await deriveKey(SECRET)
    );
    const b = await jwtVerify(
      await generateSlackInstallState(CLAIMS, SECRET),
      await deriveKey(SECRET)
    );
    expect(a.payload.jti).toBeTruthy();
    expect(a.payload.jti).not.toBe(b.payload.jti);
  });

  it("honors a custom (negative) TTL → an already-expired token", async () => {
    const state = await generateSlackInstallState(CLAIMS, SECRET, { ttlSeconds: -10 });
    await expect(
      jwtVerify(state, await deriveKey(SECRET), { algorithms: ["HS256"] })
    ).rejects.toThrow();
  });
});
