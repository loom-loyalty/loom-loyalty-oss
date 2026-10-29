import { exportJWK, generateKeyPair, SignJWT, type JWK, type KeyLike } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WORKOS_JWKS_URL } from "../shared/constants";
import { clearJWKSCache, verifyAccessToken } from "./jwt";

const ISSUER = "https://api.workos.com/";

interface TestClient {
  id: string;
  privateKey: KeyLike;
  jwk: JWK;
}

async function createTestClient(id: string): Promise<TestClient> {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = id;
  jwk.alg = "RS256";
  jwk.use = "sig";

  return { id, privateKey, jwk };
}

async function signAccessToken(client: TestClient, audience: string): Promise<string> {
  return new SignJWT({ sid: "session_123" })
    .setProtectedHeader({ alg: "RS256", kid: client.id })
    .setIssuer(ISSUER)
    .setSubject("user_123")
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(client.privateKey);
}

describe("verifyAccessToken", () => {
  beforeEach(() => {
    clearJWKSCache();
  });

  afterEach(() => {
    clearJWKSCache();
    vi.unstubAllGlobals();
  });

  it("uses a distinct JWKS for each WorkOS client ID", async () => {
    const clientA = await createTestClient("client_a");
    const clientB = await createTestClient("client_b");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === WORKOS_JWKS_URL(clientA.id)) return Response.json({ keys: [clientA.jwk] });
      if (url === WORKOS_JWKS_URL(clientB.id)) return Response.json({ keys: [clientB.jwk] });
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      verifyAccessToken(await signAccessToken(clientA, clientA.id), clientA.id)
    ).resolves.toMatchObject({ sub: "user_123" });
    await expect(
      verifyAccessToken(await signAccessToken(clientB, clientB.id), clientB.id)
    ).resolves.toMatchObject({ sub: "user_123" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([input]) => input.toString())).toEqual([
      WORKOS_JWKS_URL(clientA.id),
      WORKOS_JWKS_URL(clientB.id),
    ]);
  });

  it("rejects a validly signed token for a different audience", async () => {
    const client = await createTestClient("admin_client");
    vi.stubGlobal("fetch", async () => Response.json({ keys: [client.jwk] }));

    await expect(
      verifyAccessToken(await signAccessToken(client, "portal_client"), client.id)
    ).rejects.toThrow();
  });

  it("continues to verify a valid admin-environment token", async () => {
    const adminClient = await createTestClient("admin_client");
    vi.stubGlobal("fetch", async () => Response.json({ keys: [adminClient.jwk] }));

    await expect(
      verifyAccessToken(await signAccessToken(adminClient, adminClient.id), adminClient.id)
    ).resolves.toMatchObject({ sub: "user_123", sid: "session_123", iss: ISSUER });
  });
});
