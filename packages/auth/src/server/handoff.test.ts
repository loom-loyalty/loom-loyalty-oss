import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import type { SessionData } from "../types/session";
import { generateHandoffToken, validateHandoffToken, type HandoffTokenStore } from "./handoff";

const SECRET = "test-handoff-secret-that-is-long-enough";

function memoryStore(): HandoffTokenStore {
  const used = new Set<string>();
  return {
    async isUsed(jti) {
      return used.has(jti);
    },
    async markUsed(jti) {
      used.add(jti);
    },
  };
}

const session = {
  user: { id: "user_123", externalId: "loom_user_123" },
  idpOrganizationId: "org_123",
  sessionId: "sid_123",
} as unknown as SessionData;

async function mint(targetHub: string): Promise<string> {
  const { token } = await generateHandoffToken(
    session,
    { targetHub, organizationEnvironmentId: "env_123" },
    "env_123",
    SECRET
  );
  return token;
}

async function signRaw(target: unknown): Promise<string> {
  const secretKey = new TextEncoder().encode(SECRET.padEnd(32, "0").slice(0, 32));
  return new SignJWT({ sub: "user_123", target, jti: "raw-jti" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secretKey);
}

describe("validateHandoffToken target check", () => {
  it("accepts the exact origin of a target URL that has a path", async () => {
    const token = await mint("https://acme.weave.host/programs/setup?x=1");
    const result = await validateHandoffToken(
      token,
      SECRET,
      memoryStore(),
      "https://acme.weave.host"
    );
    expect("payload" in result).toBe(true);
  });

  it("accepts an expected origin given with a trailing slash", async () => {
    const token = await mint("https://acme.weave.host");
    const result = await validateHandoffToken(
      token,
      SECRET,
      memoryStore(),
      "https://acme.weave.host/"
    );
    expect("payload" in result).toBe(true);
  });

  it.each([
    ["empty string", ""],
    ["substring of the host", "acme"],
    ["scheme only", "https://"],
    ["host without scheme", "acme.weave.host"],
    ["different hub", "https://other.weave.host"],
    ["suffix-extended host", "https://acme.weave.host.evil.com"],
    ["different scheme", "http://acme.weave.host"],
    ["different port", "https://acme.weave.host:8443"],
    ["non-http scheme", "javascript:alert(1)"],
  ])("rejects %s", async (_label, expectedTarget) => {
    const token = await mint("https://acme.weave.host/programs");
    const store = memoryStore();
    const result = await validateHandoffToken(token, SECRET, store, expectedTarget);
    expect(result).toEqual({
      error: { code: "INVALID_TARGET", message: "Token target does not match requesting origin" },
    });
  });

  it("does not burn the token when the target check fails", async () => {
    const token = await mint("https://acme.weave.host/programs");
    const store = memoryStore();
    await validateHandoffToken(token, SECRET, store, "");
    const result = await validateHandoffToken(token, SECRET, store, "https://acme.weave.host");
    expect("payload" in result).toBe(true);
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["not a URL", "acme.weave.host"],
  ])("rejects a token whose target is %s", async (_label, target) => {
    const token = await signRaw(target);
    const result = await validateHandoffToken(
      token,
      SECRET,
      memoryStore(),
      "https://acme.weave.host"
    );
    expect("error" in result && result.error.code).toBe("INVALID_TARGET");
  });

  it("still enforces single use", async () => {
    const token = await mint("https://acme.weave.host");
    const store = memoryStore();
    await validateHandoffToken(token, SECRET, store, "https://acme.weave.host");
    const result = await validateHandoffToken(token, SECRET, store, "https://acme.weave.host");
    expect("error" in result && result.error.code).toBe("ALREADY_USED");
  });
});
