import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, getErrorCode, getFieldErrors, getRequestId, isApiErrorCode } from "./api-error";
import { sdkFetch, setApiBaseUrl, setTokenProvider } from "./sdk-client";

const problemBody = {
  type: "https://docs.loomloyalty.com/guide/error-codes#customer-already-merged",
  title: "Customer already merged",
  status: 409,
  detail: "Customer C-1 was already merged.",
  instance: "urn:uuid:7d1f0d0e-3f7a-4a35-9d3c-0f3e1f6c2b11",
  code: "CUSTOMER_ALREADY_MERGED",
  message: "Customer C-1 was already merged.",
  requestId: "7d1f0d0e-3f7a-4a35-9d3c-0f3e1f6c2b11",
  params: { customerCode: "C-1" },
  fieldErrors: [{ field: "code", code: "REQUIRED", message: "Code is required." }],
  success: false,
  errors: [{ code: 409, message: "Customer C-1 was already merged." }],
};

async function capture(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error("expected the request to fail");
}

describe("sdkFetch — ApiError", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    setApiBaseUrl("https://api.example.com");
    setTokenProvider(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    setTokenProvider(null);
  });

  it("throws an Error subclass carrying the problem-details fields", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(problemBody), {
        status: 409,
        headers: { "content-type": "application/json" },
      })
    );

    const err = await capture(sdkFetch("/customers/C-1/merges"));

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    const apiError = err as ApiError;
    expect(apiError.name).toBe("ApiError");
    expect(apiError.message).toBe("Customer C-1 was already merged.");
    expect(apiError.code).toBe("CUSTOMER_ALREADY_MERGED");
    expect(apiError.status).toBe(409);
    expect(apiError.statusCode).toBe(409);
    expect(apiError.requestId).toBe("7d1f0d0e-3f7a-4a35-9d3c-0f3e1f6c2b11");
    expect(apiError.params).toEqual({ customerCode: "C-1" });
    expect(apiError.fieldErrors).toEqual([
      { field: "code", code: "REQUIRED", message: "Code is required." },
    ]);
    expect(apiError.type).toBe(problemBody.type);
    expect(apiError.title).toBe("Customer already merged");
  });

  it("parses an application/problem+json body", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(problemBody), {
        status: 409,
        headers: { "content-type": "application/problem+json" },
      })
    );

    const err = (await capture(sdkFetch("/customers/C-1/merges"))) as ApiError;

    expect(err.code).toBe("CUSTOMER_ALREADY_MERGED");
    expect(err.requestId).toBe(problemBody.requestId);
  });

  it("reads a legacy envelope and takes the request id from the header", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: false, errors: [{ code: 400, message: "name is required" }] }),
        {
          status: 400,
          headers: { "content-type": "application/json", "x-request-id": "req-legacy" },
        }
      )
    );

    const err = (await capture(sdkFetch("/tiers"))) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("name is required");
    expect(err.code).toBe("400");
    expect(err.requestId).toBe("req-legacy");
    expect(err.fieldErrors).toEqual([]);
    expect(getErrorCode(err)).toBeUndefined();
  });

  it("handles a non-JSON 502 page", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("<html>Bad Gateway</html>", {
        status: 502,
        statusText: "Bad Gateway",
        headers: { "content-type": "text/html" },
      })
    );

    const err = (await capture(sdkFetch("/tiers"))) as ApiError;

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
    expect(err.code).toBe("502");
    expect(err.requestId).toBeUndefined();
  });

  it("keeps the envelope data payload", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ...problemBody, status: 409, data: { conflicts: ["a"] } }), {
        status: 409,
        headers: { "content-type": "application/json" },
      })
    );

    const err = (await capture(sdkFetch("/packages/p/installations"))) as ApiError;

    expect(err.data).toEqual({ conflicts: ["a"] });
  });
});

describe("error readers", () => {
  it("read catalog codes, field errors and request ids from ApiError", () => {
    const err = new ApiError({
      message: "Customer C-1 was already merged.",
      status: 409,
      code: "CUSTOMER_ALREADY_MERGED",
      requestId: "req-1",
      fieldErrors: [{ field: "email", code: "INVALID", message: "Email is invalid." }],
    });

    expect(getErrorCode(err)).toBe("CUSTOMER_ALREADY_MERGED");
    expect(getRequestId(err)).toBe("req-1");
    expect(getFieldErrors(err)).toEqual([
      { field: "email", code: "INVALID", message: "Email is invalid." },
    ]);
    expect(isApiErrorCode(err, "CONFLICT", "CUSTOMER_ALREADY_MERGED")).toBe(true);
    expect(isApiErrorCode(err, "NOT_FOUND")).toBe(false);
  });

  it("read plain objects shaped like the old SDK error", () => {
    const legacy = { message: "x", code: "DUPLICATE_RESOURCE", status: 409, requestId: "req-2" };

    expect(getErrorCode(legacy)).toBe("DUPLICATE_RESOURCE");
    expect(getRequestId(legacy)).toBe("req-2");
    expect(isApiErrorCode(legacy, "DUPLICATE_RESOURCE")).toBe(true);
  });

  it("ignore numeric legacy codes and non-error values", () => {
    expect(getErrorCode({ code: "500" })).toBeUndefined();
    expect(getErrorCode(new Error("boom"))).toBeUndefined();
    expect(getErrorCode(null)).toBeUndefined();
    expect(getErrorCode("CONFLICT")).toBeUndefined();
    expect(getRequestId(undefined)).toBeUndefined();
    expect(getFieldErrors({ fieldErrors: "nope" })).toEqual([]);
    expect(getFieldErrors({ fieldErrors: [{ field: "a", message: "m" }, { nope: true }] })).toEqual(
      [{ field: "a", code: undefined, message: "m" }]
    );
  });
});
