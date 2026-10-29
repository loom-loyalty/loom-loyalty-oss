/**
 * Tests for execution helpers — focus on `wrapApiCall` which standardizes
 * how every executor stage surfaces SDK errors. The contract: when the
 * underlying SDK call throws, the wrapper rethrows a new Error prefixed
 * with the stage description AND preserves the SDK's structured fields
 * (`code`, `statusCode`, `details`) via Object.assign so downstream
 * pattern-matching keeps working. Without this contract, a future
 * debugger only sees "Failed to create X" with no clue what the API
 * actually said.
 */

import { describe, expect, it, vi } from "vitest";

import {
  GLOBAL_EVENT_TYPE_CODES,
  RESOURCE_CODE_PATTERN,
  getErrorMessage,
  ignoreIfExists,
  isExistsError,
  sanitizePromoEventCode,
  scopePromoEventTypeCode,
  toResourceCode,
  wrapApiCall,
} from "./execution-helpers";

describe("wrapApiCall", () => {
  it("returns the underlying value when fn resolves", async () => {
    const result = await wrapApiCall("Failed to do thing", async () => 42);
    expect(result).toBe(42);
  });

  it("does not call fn more than once on success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    await wrapApiCall("Failed to do thing", fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("rethrows with stage prefix + status + preserves code/statusCode/details", async () => {
    const sdkError = {
      message: "duplicate key violation",
      code: "DUPLICATE_RULE_CODE",
      statusCode: 409,
      details: { field: "code", value: "rewards-earn" },
    };
    let caught: unknown;
    try {
      await wrapApiCall("Failed to create award rule", async () => {
        throw sdkError;
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const wrapped = caught as Error & {
      code?: string;
      statusCode?: number;
      details?: unknown;
    };
    expect(wrapped.message).toBe(
      "Failed to create award rule (status 409): duplicate key violation"
    );
    expect(wrapped.code).toBe("DUPLICATE_RULE_CODE");
    expect(wrapped.statusCode).toBe(409);
    expect(wrapped.details).toEqual({ field: "code", value: "rewards-earn" });
  });

  it("omits the (status N) portion when statusCode is missing", async () => {
    const sdkError = { message: "unknown failure" };
    let caught: unknown;
    try {
      await wrapApiCall("Failed to create program", async () => {
        throw sdkError;
      });
    } catch (err) {
      caught = err;
    }
    expect((caught as Error).message).toBe("Failed to create program: unknown failure");
  });

  it("falls back to String(err) when message is missing", async () => {
    let caught: unknown;
    try {
      await wrapApiCall("Failed to create program", async () => {
        // String throw — no message field.
        throw "raw string failure";
      });
    } catch (err) {
      caught = err;
    }
    expect((caught as Error).message).toBe("Failed to create program: raw string failure");
  });

  it("propagates message from a plain Error instance (no SDK shape)", async () => {
    let caught: unknown;
    try {
      await wrapApiCall("Failed to create tier", async () => {
        throw new Error("the disk caught fire");
      });
    } catch (err) {
      caught = err;
    }
    const wrapped = caught as Error & { code?: string; statusCode?: number; details?: unknown };
    expect(wrapped.message).toBe("Failed to create tier: the disk caught fire");
    // Plain Error has no code/statusCode/details. Object.assign DOES set
    // the keys to `undefined` (it's not a no-op — `"code" in wrapped` is
    // true) but reading them still yields `undefined`, which is what
    // downstream consumers see and what we care about.
    expect(wrapped.code).toBeUndefined();
    expect(wrapped.statusCode).toBeUndefined();
    expect(wrapped.details).toBeUndefined();
  });

  it("re-throws synchronous throws inside async fn the same way", async () => {
    let caught: unknown;
    try {
      await wrapApiCall("Failed to do sync work", async () => {
        // Synchronous throw inside the async wrapper.
        const err = { message: "boom", statusCode: 500 };
        throw err;
      });
    } catch (err) {
      caught = err;
    }
    expect((caught as Error).message).toBe("Failed to do sync work (status 500): boom");
  });
});

describe("sanitizePromoEventCode", () => {
  it("normalizes snake_case to dotted lowercase", () => {
    expect(sanitizePromoEventCode("Drink_Modification", 0)).toBe("drink.modification");
  });

  it("normalizes kebab-case to dotted lowercase", () => {
    expect(sanitizePromoEventCode("card-reload", 0)).toBe("card.reload");
  });

  it("collapses runs of separators to a single period", () => {
    expect(sanitizePromoEventCode("foo___bar---baz", 0)).toBe("foo.bar.baz");
  });

  it("drops non-conforming characters", () => {
    expect(sanitizePromoEventCode("purchase!@#$%^&*()", 0)).toBe("purchase");
  });

  it("falls back to the loop-index placeholder when input strips to empty", () => {
    // Two prose-only inputs that both reduce to "" must NOT collide on
    // the same dataModel/EVENT_TYPE entity — fallback uses promoIndex.
    expect(sanitizePromoEventCode("!@#$", 0)).toBe("promotion.event0");
    expect(sanitizePromoEventCode("!@#$", 1)).toBe("promotion.event1");
  });

  it("strips leading and trailing periods produced by separator runs", () => {
    expect(sanitizePromoEventCode("_purchase_", 0)).toBe("purchase");
  });
});

describe("scopePromoEventTypeCode", () => {
  it("prefixes the sanitized program code for non-global event types", () => {
    expect(scopePromoEventTypeCode("coffee", "drink.modification")).toBe(
      "coffee.drink.modification"
    );
  });

  it("passes global event types through unscoped", () => {
    for (const code of GLOBAL_EVENT_TYPE_CODES) {
      expect(scopePromoEventTypeCode("coffee", code)).toBe(code);
    }
  });

  it("recognizes 'birthday' as a global event type", () => {
    // Locks in the behavior the executor depends on: a promotion bound
    // to `birthday` must NOT be scoped to `<program>.birthday`, since
    // the platform fires the global event when a customer's birthday
    // hits — a program-scoped rule would never match.
    expect(scopePromoEventTypeCode("loomshop", "birthday")).toBe("birthday");
  });

  it("recognizes 'customer.created' as a global event type", () => {
    expect(scopePromoEventTypeCode("loomshop", "customer.created")).toBe("customer.created");
  });
});

describe("isExistsError", () => {
  describe("catalog code (preferred path)", () => {
    it("returns true for a DUPLICATE_RESOURCE or CONFLICT code whatever the message", () => {
      expect(isExistsError({ status: 409, code: "DUPLICATE_RESOURCE", message: "Taken." })).toBe(
        true
      );
      expect(isExistsError({ status: 409, code: "CONFLICT", message: "x" })).toBe(true);
    });

    it("still matches a wrapped error, which keeps the code", async () => {
      const err = await wrapApiCall("Creating tier", () =>
        Promise.reject({ status: 409, statusCode: 409, code: "DUPLICATE_RESOURCE", message: "x" })
      ).catch((e: unknown) => e);
      expect(isExistsError(err)).toBe(true);
    });

    it("returns false for an unrelated code even when the message says 'already exists'", () => {
      expect(
        isExistsError({
          status: 400,
          statusCode: 400,
          code: "VALIDATION_FAILED",
          message: "already exists",
        })
      ).toBe(false);
    });
  });

  describe("structured statusCode (fallback for uncoded errors)", () => {
    it("returns true for a thrown object with statusCode 409", () => {
      expect(isExistsError({ statusCode: 409, message: "anything goes here" })).toBe(true);
    });

    it("returns false for a 400 even when the message includes exists-like phrasing", () => {
      // The structured 400 must NOT be swallowed by the substring fallback
      // — that was the failure mode #496 narrows. A backend that returns
      // 400 with a body like "field conflict: type mismatch" is reporting
      // a validation error, not an already-exists collision.
      expect(isExistsError({ statusCode: 400, message: "field conflict: type mismatch" })).toBe(
        false
      );
      expect(isExistsError({ statusCode: 400, message: "duplicate key in payload" })).toBe(false);
      expect(isExistsError({ statusCode: 400, message: "already exists somewhere" })).toBe(false);
    });

    it("returns false for non-409 status codes (404, 500)", () => {
      expect(isExistsError({ statusCode: 404, message: "No such X" })).toBe(false);
      expect(isExistsError({ statusCode: 500, message: "internal" })).toBe(false);
    });

    it("returns true for a 500 carrying a Postgres unique-constraint violation", () => {
      // Some platform endpoints leak raw Postgres errors as 500 instead of
      // translating to 409. Both phrases must appear so unrelated 500 bodies
      // that mention only "duplicate" or only "constraint" don't false-match.
      expect(
        isExistsError({
          statusCode: 500,
          message:
            'Internal Server Error: Error executing PERSIST: ERROR: duplicate key value violates unique constraint "uk_metadata_organization_id_metadata_type_id_code"',
        })
      ).toBe(true);
    });

    it("still returns false for a 500 mentioning only 'duplicate' or 'constraint' in isolation", () => {
      expect(isExistsError({ statusCode: 500, message: "duplicate request received" })).toBe(false);
      expect(isExistsError({ statusCode: 500, message: "constraint solver timed out" })).toBe(
        false
      );
    });

    it("preserves the structured path for Errors decorated by wrapApiCall", async () => {
      // wrapApiCall does Object.assign with the statusCode, then rethrows
      // a real Error. isExistsError must consult that statusCode rather
      // than fall through to the (decorated) message.
      let caught: unknown;
      try {
        await wrapApiCall("create thing", async () => {
          throw { statusCode: 409, message: "already exists somewhere" };
        });
      } catch (err) {
        caught = err;
      }
      expect(isExistsError(caught)).toBe(true);
    });
  });

  describe("substring fallback (no statusCode present)", () => {
    it("recognizes 'already exists'", () => {
      expect(isExistsError(new Error("Resource already exists"))).toBe(true);
    });

    it("recognizes a whole-word 409", () => {
      expect(isExistsError(new Error("409 Conflict"))).toBe(true);
    });

    it("does NOT match the digits 4090 as a 409", () => {
      expect(isExistsError(new Error("4090 pending operations"))).toBe(false);
    });

    it("recognizes 'duplicate key', 'duplicate entry', 'unique constraint'", () => {
      expect(isExistsError(new Error("duplicate key violation"))).toBe(true);
      expect(isExistsError(new Error("Duplicate entry for primary"))).toBe(true);
      expect(isExistsError(new Error("unique constraint violated"))).toBe(true);
    });

    it("recognizes 'conflict:' (colon-terminated)", () => {
      expect(isExistsError(new Error("conflict: code already in use"))).toBe(true);
    });

    it("does NOT match generic 'conflict' wording without a colon", () => {
      // The plan, regression-locked: phrases like "merge conflict error
      // in config" must NOT be swallowed.
      expect(isExistsError(new Error("merge conflict error in config"))).toBe(false);
    });

    it("returns false for arbitrary other errors", () => {
      expect(isExistsError(new Error("the disk caught fire"))).toBe(false);
      expect(isExistsError("plain string")).toBe(false);
      expect(isExistsError(null)).toBe(false);
      expect(isExistsError(undefined)).toBe(false);
    });
  });
});

describe("ignoreIfExists", () => {
  it("returns silently for a structured 409 error", () => {
    expect(() => ignoreIfExists({ statusCode: 409, message: "anything" }, "thing-1")).not.toThrow();
  });

  it("re-throws prefixed for a structured 400 with conflict-shaped phrasing", () => {
    // The bug #496 narrows: a 400 with "conflict:" in the body must
    // propagate as a real failure, not get silently swallowed.
    expect(() =>
      ignoreIfExists({ statusCode: 400, message: "field conflict: type mismatch" }, "thing-2")
    ).toThrow(/Failed to create thing-2: field conflict: type mismatch/);
  });

  it("re-throws for unrelated errors with a labelled message", () => {
    expect(() => ignoreIfExists(new Error("network down"), "thing-3")).toThrow(
      /Failed to create thing-3: network down/
    );
  });
});

describe("getErrorMessage (regression: do not regress on the helper used by wrapApiCall fallback)", () => {
  it("extracts message from Error instances", () => {
    expect(getErrorMessage(new Error("plain"))).toBe("plain");
  });

  it("extracts message from objects with a message field", () => {
    expect(getErrorMessage({ message: "object-shaped" })).toBe("object-shaped");
  });

  it("returns a default for unknown shapes", () => {
    expect(getErrorMessage(42)).toBe("An unexpected error occurred");
    expect(getErrorMessage(null)).toBe("An unexpected error occurred");
    expect(getErrorMessage(undefined)).toBe("An unexpected error occurred");
  });
});

describe("toResourceCode", () => {
  /**
   * The API validates these with
   * `@Pattern("^(?=.{1,63}$)[a-z0-9]+(?:-[a-z0-9]+)*$")`. Asserting against the
   * exported pattern rather than a hand-written expectation is what makes this
   * generalize: any future generator can be checked the same way, which is the
   * gap that let an UPPER_SNAKE data-model-type code ship.
   */
  it("turns an event-type code into a valid resource code", () => {
    // The concrete break: a dotted event-type code reused as a DataModelType
    // code. Dots are not valid separators in the resource-code pattern.
    expect(toResourceCode("myprogram.purchase")).toBe("myprogram-purchase");
    expect(RESOURCE_CODE_PATTERN.test(toResourceCode("myprogram.purchase"))).toBe(true);
  });

  it("lowercases and re-separates an UPPER_SNAKE code", () => {
    // The other concrete break: `${program}_${event}`.toUpperCase().
    expect(toResourceCode("MYPROGRAM_PURCHASE")).toBe("myprogram-purchase");
    expect(toResourceCode("BIRTHDAY")).toBe("birthday");
  });

  it("collapses runs of separators instead of leaving empty segments", () => {
    // "a--b" and "a..b" would both fail the pattern, which rejects an empty
    // segment between two hyphens.
    expect(toResourceCode("a..b__c--d")).toBe("a-b-c-d");
    expect(RESOURCE_CODE_PATTERN.test(toResourceCode("a..b__c--d"))).toBe(true);
  });

  it("strips leading and trailing separators", () => {
    expect(toResourceCode("_leading.trailing_")).toBe("leading-trailing");
    expect(toResourceCode("...")).toBe("generated");
  });

  it("falls back rather than returning something the API would reject", () => {
    expect(toResourceCode(undefined)).toBe("generated");
    expect(toResourceCode("")).toBe("generated");
    expect(toResourceCode("!!!", "event-schema")).toBe("event-schema");
  });

  it("truncates to the 63-character limit without a trailing hyphen", () => {
    // Slicing mid-string can land on a separator, which the pattern rejects.
    const long = `${"a".repeat(62)}-${"b".repeat(20)}`;
    const code = toResourceCode(long);

    expect(code.length).toBeLessThanOrEqual(63);
    expect(code.endsWith("-")).toBe(false);
    expect(RESOURCE_CODE_PATTERN.test(code)).toBe(true);
  });

  it("leaves an already-valid code untouched", () => {
    expect(toResourceCode("custom-event")).toBe("custom-event");
    expect(toResourceCode("purchase")).toBe("purchase");
  });

  it("produces a pattern-valid code for every shape these executors generate", () => {
    for (const raw of [
      "myprogram.purchase",
      "MYPROGRAM_PURCHASE",
      "BIRTHDAY",
      "program.birthday",
      "Hotel Rewards Q4",
      "e2e-nl-1234.purchase",
      "9lives",
    ]) {
      expect(RESOURCE_CODE_PATTERN.test(toResourceCode(raw)), raw).toBe(true);
    }
  });
});
