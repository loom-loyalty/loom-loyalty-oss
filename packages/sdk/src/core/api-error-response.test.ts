import { afterEach, describe, expect, it, vi } from "vitest";

import { BaseResource } from "../client/base-resource";
import { ApiError, apiErrorFromBody } from "./api-error";
import { apiRequest } from "./client";
import { unwrapResponse } from "./sdk-client";

const problem = {
  type: "https://docs.loomloyalty.com/guide/error-codes#duplicate-resource",
  title: "Duplicate resource",
  code: "DUPLICATE_RESOURCE",
  message: "An offer with this code already exists.",
  requestId: "req-body",
  params: { code: "SPRING" },
  fieldErrors: [{ field: "code", code: "DUPLICATE", message: "Code is taken." }],
};

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  const text = JSON.stringify(body);
  return new Response(text, {
    status,
    headers: {
      "content-type": "application/problem+json",
      "content-length": String(text.length),
      ...headers,
    },
  });
}

describe("apiErrorFromBody", () => {
  it("reads problem details, and the body's request id wins over the header", () => {
    const err = apiErrorFromBody(problem, { status: 409, requestIdHeader: "req-header" });

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 409,
      code: "DUPLICATE_RESOURCE",
      message: "An offer with this code already exists.",
      requestId: "req-body",
      params: { code: "SPRING" },
      type: problem.type,
      title: "Duplicate resource",
      fieldErrors: [{ field: "code", code: "DUPLICATE", message: "Code is taken." }],
    });
  });

  it("reads the legacy envelope and falls back to the header id", () => {
    const err = apiErrorFromBody(
      { success: false, errors: [{ code: 4001, message: "Name is required." }] },
      { status: 400, requestIdHeader: "req-header" }
    );

    expect(err).toMatchObject({
      message: "Name is required.",
      code: "4001",
      requestId: "req-header",
    });
  });

  it("ignores malformed members and falls back to text, status text, then a generic line", () => {
    const err = apiErrorFromBody(
      { requestId: "", params: "nope", type: 7 },
      { status: 502, statusText: "Bad Gateway", rawText: "<html>upstream</html>" }
    );
    expect(err).toMatchObject({
      message: "<html>upstream</html>",
      code: "502",
      requestId: undefined,
    });
    expect(err.params).toBeUndefined();
    expect(err.type).toBeUndefined();

    expect(apiErrorFromBody(null, { status: 503, statusText: "Unavailable" }).message).toBe(
      "Unavailable"
    );
    expect(apiErrorFromBody(null, { status: 500 }).message).toBe("Request failed with status 500");
  });
});

describe("unwrapResponse with success: false", () => {
  it("keeps the envelope's code and request id", () => {
    let thrown: unknown;
    try {
      unwrapResponse({
        success: false,
        data: null,
        code: "PROGRAM_NOT_ACTIVE",
        requestId: "req-env",
        errors: [{ code: 1, message: "Program is not active." }],
      });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ApiError);
    expect(thrown).toMatchObject({
      status: 400,
      code: "PROGRAM_NOT_ACTIVE",
      requestId: "req-env",
      message: "Program is not active.",
    });
  });
});

class Offers extends BaseResource {
  get(): Promise<unknown> {
    return this.fetch("/offers/1");
  }
}

describe("other SDK entry points throw the same ApiError", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("BaseResource throws the full ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(409, problem)));
    const offers = new Offers({ baseUrl: "https://api.test", tokenProvider: () => "t" });

    const err = await offers.get().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: "DUPLICATE_RESOURCE", requestId: "req-body", status: 409 });
    expect((err as ApiError).fieldErrors).toHaveLength(1);
  });

  it("apiRequest returns the full ApiError, and status 0 for a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(409, { ...problem, requestId: undefined }, { "x-request-id": "req-h" })
        )
    );
    const failed = await apiRequest("/offers", {}, "t");
    expect(failed.success).toBe(false);
    expect(failed.error).toMatchObject({ code: "DUPLICATE_RESOURCE", requestId: "req-h" });
    expect(failed.error?.fieldErrors).toHaveLength(1);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const offline = await apiRequest("/offers", {}, "t");
    expect(offline.error).toMatchObject({ status: 0, message: "Failed to fetch" });
  });
});
