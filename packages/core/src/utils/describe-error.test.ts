import { ApiError } from "@loom-loyalty/sdk";
import { describe, expect, it } from "vitest";

import { GENERIC_ERROR_MESSAGE, describeError } from "./describe-error";

describe("describeError", () => {
  it("shows the API message for a coded 4xx", () => {
    const err = new ApiError({
      message: "Customer C-1 was already merged.",
      status: 409,
      code: "CUSTOMER_ALREADY_MERGED",
      requestId: "req-1",
    });

    expect(describeError(err)).toEqual({
      message: "Customer C-1 was already merged.",
      code: "CUSTOMER_ALREADY_MERGED",
      requestId: "req-1",
      fieldErrors: [],
      retryable: false,
      unexpected: false,
    });
  });

  it("shows a generic message and the request id for a 5xx", () => {
    const err = new ApiError({
      message: "duplicate key value violates unique constraint",
      status: 500,
      code: "INTERNAL_ERROR",
      requestId: "req-2",
    });

    const described = describeError(err);

    expect(described.message).toBe(GENERIC_ERROR_MESSAGE);
    expect(described.requestId).toBe("req-2");
    expect(described.retryable).toBe(true);
    expect(described.unexpected).toBe(true);
  });

  it("treats a network failure (status 0) as retryable and unexpected", () => {
    const described = describeError(new ApiError({ message: "Failed to fetch", status: 0 }));

    expect(described.message).toBe(GENERIC_ERROR_MESSAGE);
    expect(described.retryable).toBe(true);
  });

  it("treats a rate limit or timeout as retryable but expected", () => {
    for (const status of [408, 429]) {
      const described = describeError(
        new ApiError({ message: "Slow down.", status, code: "RATE_LIMITED" })
      );
      expect(described).toMatchObject({
        message: "Slow down.",
        retryable: true,
        unexpected: false,
      });
    }
  });

  it("never shows a raw code or status for a 4xx", () => {
    const described = describeError({ message: "Bad", code: "400", status: 400, statusCode: 400 });

    expect(described.message).toBe("Bad");
    expect(described.code).toBeUndefined();
  });

  it("applies a per-code override with params", () => {
    const err = new ApiError({
      message: "Not enough points.",
      status: 409,
      code: "INSUFFICIENT_POINTS",
      params: { shortfall: 40 },
    });

    const described = describeError(err, {
      overrides: {
        INSUFFICIENT_POINTS: (params) => `You need ${String(params.shortfall)} more points.`,
      },
    });

    expect(described.message).toBe("You need 40 more points.");
  });

  it("applies a string override and a generic override for unexpected errors", () => {
    const err = new ApiError({ message: "x", status: 403, code: "FORBIDDEN" });

    expect(describeError(err, { overrides: { FORBIDDEN: "Ask your admin." } }).message).toBe(
      "Ask your admin."
    );
    expect(
      describeError(new ApiError({ message: "x", status: 500 }), { genericMessage: "Oops." })
        .message
    ).toBe("Oops.");
  });

  it("returns field errors", () => {
    const err = new ApiError({
      message: "Check the highlighted fields.",
      status: 400,
      code: "VALIDATION_FAILED",
      fieldErrors: [{ field: "email", code: "INVALID", message: "Email is invalid." }],
    });

    expect(describeError(err).fieldErrors).toEqual([
      { field: "email", code: "INVALID", message: "Email is invalid." },
    ]);
  });

  it("keeps an app Error's message but hides runtime faults", () => {
    const appError = describeError(new Error("Pick a program first."));
    expect(appError.message).toBe("Pick a program first.");
    expect(appError.retryable).toBe(true);
    expect(describeError(new TypeError("x is undefined")).message).toBe(GENERIC_ERROR_MESSAGE);
  });

  it("keeps the message of a plain object with no status", () => {
    expect(describeError({ message: "Selection rejected" }).message).toBe("Selection rejected");
  });

  it("uses the fallback for unknown values and passes strings through", () => {
    expect(describeError(undefined, { fallback: "Couldn't load offers." }).message).toBe(
      "Couldn't load offers."
    );
    expect(describeError(42).message).toBe(GENERIC_ERROR_MESSAGE);
    expect(describeError("Plain text").message).toBe("Plain text");
  });
});
