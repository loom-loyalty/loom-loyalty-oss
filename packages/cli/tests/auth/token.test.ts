import { describe, expect, it } from "vitest";
import { classifyToken, isTokenExpired } from "../../src/auth/token.js";

function createMockJwt(payload: Record<string, unknown>): string {
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = "mock-signature";
  return `${headerB64}.${payloadB64}.${signature}`;
}

describe("isTokenExpired", () => {
  it("should return true for invalid token format", () => {
    expect(isTokenExpired("invalid")).toBe(true);
    expect(isTokenExpired("")).toBe(true);
    expect(isTokenExpired("a.b")).toBe(true);
  });

  it("should return true for expired token", () => {
    const payload = { exp: Math.floor(Date.now() / 1000) - 3600 };
    expect(isTokenExpired(createMockJwt(payload))).toBe(true);
  });

  it("should return false for valid token", () => {
    const payload = { exp: Math.floor(Date.now() / 1000) + 3600 };
    expect(isTokenExpired(createMockJwt(payload))).toBe(false);
  });

  it("should return false for token without expiration", () => {
    const payload = { sub: "user123" };
    expect(isTokenExpired(createMockJwt(payload))).toBe(false);
  });

  it("should return false for an llk_ M2M API key", () => {
    expect(isTokenExpired("llk_abc123_supersecretvalue")).toBe(false);
  });

  it("should return true for a bare llk_ prefix with no content", () => {
    expect(isTokenExpired("llk_")).toBe(true);
  });

  it("should return false for an llk_ key with no internal segments", () => {
    // No format beyond the prefix is enforced client-side — the backend validates it.
    expect(isTokenExpired("llk_only-one-segment")).toBe(false);
  });

  it("should trim a trailing newline (as a CI secret might carry)", () => {
    expect(isTokenExpired("llk_abc_def\n")).toBe(false);
  });

  it("should never route an llk_-prefixed string into JWT decoding, even with dots", () => {
    expect(isTokenExpired("llk_has.two.dots")).toBe(false);
  });
});

describe("classifyToken", () => {
  it("should classify an llk_ M2M API key", () => {
    expect(classifyToken("llk_abc123_supersecretvalue")).toEqual({ kind: "m2m" });
  });

  it("should classify a valid unexpired JWT", () => {
    const payload = { exp: Math.floor(Date.now() / 1000) + 3600 };
    expect(classifyToken(createMockJwt(payload))).toEqual({ kind: "jwt", expired: false });
  });

  it("should classify an expired JWT", () => {
    const payload = { exp: Math.floor(Date.now() / 1000) - 3600 };
    expect(classifyToken(createMockJwt(payload))).toEqual({ kind: "jwt", expired: true });
  });

  it("should classify garbage as unknown", () => {
    expect(classifyToken("invalid")).toEqual({ kind: "unknown" });
    expect(classifyToken("")).toEqual({ kind: "unknown" });
    expect(classifyToken("a.b")).toEqual({ kind: "unknown" });
  });
});
