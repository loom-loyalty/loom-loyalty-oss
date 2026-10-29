import { describe, expect, it } from "vitest";

import { expressionSchema } from "@loom-loyalty/schema/expressions";

import { detectCorruptedNodes, normalizeExpression } from "./migrate";

/**
 * Every recoverable normalization must produce a tree the frozen SSOT accepts.
 * `expressionSchema` is the single source of truth
 * (`@loom-loyalty/schema/expressions`); if the normalized shape does not parse,
 * the migration is wrong.
 */
function expectParses(raw: unknown): void {
  const normalized = normalizeExpression(raw);
  const result = expressionSchema.safeParse(normalized);
  expect(result.success, JSON.stringify(result, null, 2)).toBe(true);
}

/** Wrap a pre-operation in a valid numeric-comparison host so it can be parsed. */
function hostWithPreOp(preOp: unknown): unknown {
  return {
    greaterThan: { path: "$.amount", value: 10, extractValueFromPath: false, preOperation: preOp },
  };
}

/** Wrap actions in a valid `true` host so they can be parsed. */
function hostWithActions(actions: unknown[]): unknown {
  return { true: { actions } };
}

// -----------------------------------------------------------------------------
// Recoverable renames — each round-trips to a shape the SSOT accepts
// -----------------------------------------------------------------------------

describe("normalizeExpression — recoverable pre-operation renames", () => {
  it("maps numeric pre-op `value` -> `operand`", () => {
    const normalized = normalizeExpression(hostWithPreOp({ multiply: { value: 2 } })) as {
      greaterThan: { preOperation: { multiply: { operand: number } } };
    };
    expect(normalized.greaterThan.preOperation).toEqual({ multiply: { operand: 2 } });
    expectParses(hostWithPreOp({ multiply: { value: 2 } }));
    expectParses(hostWithPreOp({ subtract: { value: 5 } }));
    expectParses(hostWithPreOp({ add: { value: 1 } }));
    expectParses(hostWithPreOp({ divide: { value: 4 } }));
    expectParses(hostWithPreOp({ modulo: { value: 3 } }));
  });

  it("maps `substring` -> `subString` and `startIndex` -> `beginIndex` (endIndex unchanged)", () => {
    const normalized = normalizeExpression(
      hostWithPreOp({ substring: { startIndex: 0, endIndex: 3 } })
    ) as { greaterThan: { preOperation: unknown } };
    expect(normalized.greaterThan.preOperation).toEqual({
      subString: { beginIndex: 0, endIndex: 3 },
    });
    expectParses(hostWithPreOp({ substring: { startIndex: 2, endIndex: 5 } }));
  });

  it("maps `dateTime` -> `datetime` and `format` -> `pattern`", () => {
    const normalized = normalizeExpression(
      hostWithPreOp({ dateTime: { format: "yyyy-MM-dd" } })
    ) as { greaterThan: { preOperation: unknown } };
    expect(normalized.greaterThan.preOperation).toEqual({
      datetime: { pattern: "yyyy-MM-dd" },
    });
    expectParses(hostWithPreOp({ dateTime: { format: "yyyy-MM-dd" } }));
  });
});

describe("normalizeExpression — recoverable operator renames", () => {
  it("maps `between` minValue/maxValue -> lowerBound/upperBound", () => {
    const raw = {
      between: { path: "$.amount", minValue: 0, maxValue: 100, extractValueFromPath: false },
    };
    const normalized = normalizeExpression(raw) as { between: Record<string, unknown> };
    expect(normalized.between).toEqual({
      path: "$.amount",
      lowerBound: 0,
      upperBound: 100,
      extractValueFromPath: false,
    });
    expectParses(raw);
  });

  it("maps `hasProgramCurrency` minimumBalance -> comparisonAmount and drops server-derived ids", () => {
    const raw = {
      hasProgramCurrency: {
        programCurrencyCode: "POINTS",
        minimumBalance: 500,
        programId: "p1",
        programCode: "MAIN",
      },
    };
    const normalized = normalizeExpression(raw) as { hasProgramCurrency: Record<string, unknown> };
    expect(normalized.hasProgramCurrency).toEqual({
      programCurrencyCode: "POINTS",
      comparisonAmount: 500,
    });
    expect("programId" in normalized.hasProgramCurrency).toBe(false);
    expect("programCode" in normalized.hasProgramCurrency).toBe(false);
    expectParses(raw);
  });
});

describe("normalizeExpression — recoverable action renames", () => {
  it("spreads a dropped `properties` bag to the top level of the action", () => {
    const raw = hostWithActions([
      { issueCustomerCoupon: { couponCode: "X", properties: { source: "legacy" } } },
    ]);
    const normalized = normalizeExpression(raw) as {
      true: { actions: Array<{ issueCustomerCoupon: Record<string, unknown> }> };
    };
    const action = normalized.true.actions[0]!.issueCustomerCoupon;
    expect(action.source).toBe("legacy");
    expect("properties" in action).toBe(false);
    expectParses(raw);
  });

  it("drops a boolean `defaultResult` on coupon use/hold/return (unrecoverable coupon code)", () => {
    const raw = hostWithActions([{ useCustomerCoupon: { defaultResult: true } }]);
    const normalized = normalizeExpression(raw) as {
      true: { actions: Array<{ useCustomerCoupon: Record<string, unknown> }> };
    };
    expect("defaultResult" in normalized.true.actions[0]!.useCustomerCoupon).toBe(false);
    expectParses(raw);
  });

  it("keeps a string `defaultResult` on coupon actions untouched", () => {
    const raw = hostWithActions([{ holdCustomerCoupon: { defaultResult: "SAVE10" } }]);
    const normalized = normalizeExpression(raw) as {
      true: { actions: Array<{ holdCustomerCoupon: Record<string, unknown> }> };
    };
    expect(normalized.true.actions[0]!.holdCustomerCoupon.defaultResult).toBe("SAVE10");
    expectParses(raw);
  });

  it("recovers a legacy coupon-mutation `couponCode` string into `defaultResult`", () => {
    const raw = hostWithActions([{ useCustomerCoupon: { couponCode: "SAVE10" } }]);
    const normalized = normalizeExpression(raw) as {
      true: { actions: Array<{ useCustomerCoupon: Record<string, unknown> }> };
    };
    const action = normalized.true.actions[0]!.useCustomerCoupon;
    expect(action.defaultResult).toBe("SAVE10");
    expect("couponCode" in action).toBe(false);
    expectParses(raw);
  });

  it("recovers `couponId` when no `couponCode` is present", () => {
    const raw = hostWithActions([{ holdCustomerCoupon: { couponId: "cpn_1" } }]);
    const normalized = normalizeExpression(raw) as {
      true: { actions: Array<{ holdCustomerCoupon: Record<string, unknown> }> };
    };
    const action = normalized.true.actions[0]!.holdCustomerCoupon;
    expect(action.defaultResult).toBe("cpn_1");
    expect("couponId" in action).toBe(false);
    expectParses(raw);
  });

  it("recovers the coupon code even when a legacy boolean `defaultResult` also rode along", () => {
    const raw = hostWithActions([
      { returnCustomerCoupon: { defaultResult: true, couponCode: "SAVE10" } },
    ]);
    const normalized = normalizeExpression(raw) as {
      true: { actions: Array<{ returnCustomerCoupon: Record<string, unknown> }> };
    };
    const action = normalized.true.actions[0]!.returnCustomerCoupon;
    expect(action.defaultResult).toBe("SAVE10");
    expect("couponCode" in action).toBe(false);
    expectParses(raw);
  });

  it("strips prototype-pollution keys from a spread `properties` bag", () => {
    const raw = hostWithActions([
      {
        issueCustomerCoupon: {
          couponOfferCode: "OFFER1",
          properties: JSON.parse('{"__proto__":{"polluted":true},"constructor":1,"source":"ok"}'),
        },
      },
    ]);
    const normalized = normalizeExpression(raw) as {
      true: { actions: Array<{ issueCustomerCoupon: Record<string, unknown> }> };
    };
    const action = normalized.true.actions[0]!.issueCustomerCoupon;
    expect(action.source).toBe("ok");
    expect(Object.prototype.hasOwnProperty.call(action, "__proto__")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(action, "constructor")).toBe(false);
    // The global prototype was not polluted.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expectParses(raw);
  });

  it("normalizes a pre-operation nested inside an action", () => {
    const raw = hostWithActions([
      {
        issueProgramCurrency: {
          defaultResult: 500,
          isFixedAmount: true,
          programCurrencyCode: "POINTS",
          preOperation: { subtract: { value: 1 } },
        },
      },
    ]);
    const normalized = normalizeExpression(raw) as {
      true: { actions: Array<{ issueProgramCurrency: { preOperation: unknown } }> };
    };
    expect(normalized.true.actions[0]!.issueProgramCurrency.preOperation).toEqual({
      subtract: { operand: 1 },
    });
    expectParses(raw);
  });
});

// -----------------------------------------------------------------------------
// Recursion + idempotency
// -----------------------------------------------------------------------------

const OLD_DEEP_TREE = {
  and: {
    children: [
      {
        greaterThan: {
          path: "$.amount",
          value: 100,
          extractValueFromPath: false,
          preOperation: { multiply: { value: 2 } },
        },
      },
      {
        or: {
          children: [
            {
              between: { path: "$.items", minValue: 3, maxValue: 10, extractValueFromPath: false },
            },
            {
              hasProgramCurrency: {
                programCurrencyCode: "POINTS",
                minimumBalance: 500,
                programId: "p1",
                programCode: "MAIN",
              },
            },
          ],
        },
      },
    ],
    actions: [
      { issueCustomerCoupon: { couponCode: "X", properties: { source: "legacy" } } },
      {
        issueProgramCurrency: {
          defaultResult: 500,
          isFixedAmount: true,
          programCurrencyCode: "POINTS",
          preOperation: { subtract: { value: 1 } },
        },
      },
    ],
  },
};

describe("normalizeExpression — recursion + idempotency", () => {
  it("walks composite children, actions, and nested pre-operations, producing a valid tree", () => {
    expectParses(OLD_DEEP_TREE);
  });

  it("is idempotent — a second pass is a no-op", () => {
    const once = normalizeExpression(OLD_DEEP_TREE);
    const twice = normalizeExpression(once);
    expect(twice).toEqual(once);
  });

  it("leaves already-corrected (new-shape) data unchanged", () => {
    const alreadyNew = {
      and: {
        children: [
          { between: { path: "$.x", lowerBound: 0, upperBound: 10, extractValueFromPath: false } },
        ],
      },
    };
    expect(normalizeExpression(alreadyNew)).toEqual(alreadyNew);
    expectParses(alreadyNew);
  });

  it("does not mutate its input", () => {
    const frozenInput = structuredClone(OLD_DEEP_TREE);
    normalizeExpression(OLD_DEEP_TREE);
    expect(OLD_DEEP_TREE).toEqual(frozenInput);
  });

  it("passes non-object input through without throwing", () => {
    expect(normalizeExpression(null)).toBeNull();
    expect(normalizeExpression("nonsense")).toBe("nonsense");
  });
});

// -----------------------------------------------------------------------------
// Corrupted / unrecoverable detection
// -----------------------------------------------------------------------------

describe("detectCorruptedNodes", () => {
  it("flags a `between` missing both old and new bounds", () => {
    const issues = detectCorruptedNodes({
      between: { path: "$.x", extractValueFromPath: false },
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.op).toBe("between");
    expect(issues[0]!.reason).toMatch(/bound/i);
  });

  it("flags a `between` missing only one bound", () => {
    const issues = detectCorruptedNodes({
      between: { path: "$.x", minValue: 0, extractValueFromPath: false },
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]!.op).toBe("between");
  });

  it("flags a numeric pre-op missing both value and operand", () => {
    const issues = detectCorruptedNodes(hostWithPreOp({ multiply: {} }));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.op).toBe("multiply");
    expect(issues[0]!.path).toBe("$.greaterThan.preOperation.multiply");
  });

  it("no longer flags isMetadataType / inMetadataGroup (the backend accepts them on events again)", () => {
    expect(
      detectCorruptedNodes({
        isMetadataType: {
          path: "$.x",
          metadataTypeCode: "T",
          metadataCode: "C",
          defaultResult: false,
        },
      })
    ).toEqual([]);
    expect(
      detectCorruptedNodes({
        inMetadataGroup: {
          path: "$.x",
          metadataTypeCode: "T",
          metadataGroupCode: "G",
          defaultResult: false,
        },
      })
    ).toEqual([]);
  });

  it("flags a coupon action with a boolean defaultResult (was boolean, now a coupon code)", () => {
    const issues = detectCorruptedNodes(
      hostWithActions([{ returnCustomerCoupon: { defaultResult: false } }])
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]!.op).toBe("returnCustomerCoupon");
  });

  it("flags an unrecoverable residual coupon reference (defaultResult already a string)", () => {
    const issues = detectCorruptedNodes(
      hostWithActions([{ useCustomerCoupon: { defaultResult: "GOOD", couponCode: "STALE" } }])
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]!.op).toBe("useCustomerCoupon");
    expect(issues[0]!.reason).toMatch(/could not be migrated/i);
  });

  it("does not flag a coupon boolean when the code is recoverable from couponCode/couponId", () => {
    expect(
      detectCorruptedNodes(hostWithActions([{ holdCustomerCoupon: { couponId: "cpn_1" } }]))
    ).toEqual([]);
    expect(
      detectCorruptedNodes(
        hostWithActions([{ useCustomerCoupon: { defaultResult: true, couponCode: "SAVE10" } }])
      )
    ).toEqual([]);
  });

  it("reports precise paths for nested corrupt nodes", () => {
    const tree = {
      and: {
        children: [{ true: {} }, { between: { path: "$.y", extractValueFromPath: false } }],
        actions: [{ useCustomerCoupon: { defaultResult: true } }],
      },
    };
    const issues = detectCorruptedNodes(tree);
    const paths = issues.map((i) => i.path);
    expect(paths).toContain("$.and.children[1].between");
    expect(paths).toContain("$.and.actions[0].useCustomerCoupon");
  });

  it("returns no false positives on recoverable OLD-shaped data", () => {
    expect(detectCorruptedNodes(OLD_DEEP_TREE)).toEqual([]);
  });

  it("returns no issues for a clean new-shape tree", () => {
    expect(
      detectCorruptedNodes({
        between: { path: "$.x", lowerBound: 0, upperBound: 10, extractValueFromPath: false },
      })
    ).toEqual([]);
  });

  it("returns no issues for non-object input", () => {
    expect(detectCorruptedNodes(null)).toEqual([]);
    expect(detectCorruptedNodes(42)).toEqual([]);
  });
});
