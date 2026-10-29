/**
 * Tests for the MSW v2 shim — confirms setupServer + http + HttpResponse
 * re-exports work end-to-end. Per-entity handler factories live with their
 * consumers (pilots), not in test-utils itself.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { http, HttpResponse, setupServer } from "./index.js";

describe("msw shim re-exports", () => {
  it("exports setupServer as a callable", () => {
    expect(typeof setupServer).toBe("function");
  });

  it("exports http with verb factories", () => {
    expect(typeof http.get).toBe("function");
    expect(typeof http.post).toBe("function");
    expect(typeof http.put).toBe("function");
    expect(typeof http.delete).toBe("function");
  });

  it("exports HttpResponse as a class", () => {
    expect(typeof HttpResponse).toBe("function");
    expect(typeof HttpResponse.json).toBe("function");
  });
});

describe("setupServer end-to-end", () => {
  const server = setupServer(
    http.get("https://example.test/metadata", () =>
      HttpResponse.json({ data: [{ code: "FIAT_CURRENCY_TYPE" }] })
    )
  );

  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it("intercepts a real fetch and returns the configured JSON body", async () => {
    const response = await fetch("https://example.test/metadata");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ code: string }> };
    expect(body).toEqual({ data: [{ code: "FIAT_CURRENCY_TYPE" }] });
  });

  it("supports per-test handler overrides via server.use()", async () => {
    server.use(
      http.get("https://example.test/metadata", () =>
        HttpResponse.json({ data: [{ code: "OVERRIDE" }] })
      )
    );

    const response = await fetch("https://example.test/metadata");
    const body = (await response.json()) as { data: Array<{ code: string }> };
    expect(body).toEqual({ data: [{ code: "OVERRIDE" }] });
  });
});
