import { describe, expect, it } from "vitest";

import {
  ACTION_NAMES,
  expressionActionSchema,
  REWARD_ACTION_GROUNDING,
  REWARD_ACTION_NAMES,
  REWARD_CONTEXT_KEYS,
  rewardActionSchema,
} from "./actions.js";
import { conditionExpressionSchema, expressionSchema, type Expression } from "./operators.js";
import { PRE_OPERATION_NAMES, preOperationSchema } from "./pre-operations.js";
import { ALL_OPERATORS } from "./surfaces.js";

// A trivially-valid leaf used to fill composite children / action targets.
const LEAF = { true: {} };

// -----------------------------------------------------------------------------
// Pre-operations
// -----------------------------------------------------------------------------

const VALID_PRE_OPS: Record<string, unknown> = {
  add: { add: { operand: 5 } },
  subtract: { subtract: { operand: 5 } },
  multiply: { multiply: { operand: 2 } },
  divide: { divide: { operand: 2 } },
  modulo: { modulo: { operand: 3 } },
  length: { length: {} },
  subString: { subString: { beginIndex: 0, endIndex: 3 } },
  size: { size: {} },
  epoch: { epoch: {} },
  datetime: { datetime: { pattern: "yyyy-MM-dd" } },
  diffFromCurrentEpoch: { diffFromCurrentEpoch: {} },
  matchesCurrentDate: { matchesCurrentDate: {} },
};

describe("preOperationSchema", () => {
  it("accepts every one of the 12 corrected pre-operations", () => {
    expect(Object.keys(VALID_PRE_OPS).sort()).toEqual([...PRE_OPERATION_NAMES].sort());
    for (const [name, sample] of Object.entries(VALID_PRE_OPS)) {
      expect(preOperationSchema.safeParse(sample).success, name).toBe(true);
    }
  });

  it("rejects the pre-drift field names", () => {
    // `value` was renamed to `operand`.
    expect(preOperationSchema.safeParse({ multiply: { value: 5 } }).success).toBe(false);
    // `substring` / `startIndex` were renamed to `subString` / `beginIndex`.
    expect(
      preOperationSchema.safeParse({ substring: { startIndex: 0, endIndex: 3 } }).success
    ).toBe(false);
    // `dateTime` / `format` were renamed to `datetime` / `pattern`.
    expect(preOperationSchema.safeParse({ dateTime: { format: "x" } }).success).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// Actions
// -----------------------------------------------------------------------------

const VALID_ACTIONS: Record<string, unknown> = {
  issueProgramCurrency: {
    issueProgramCurrency: {
      defaultResult: 100,
      isFixedAmount: true,
      programCurrencyCode: "POINTS",
    },
  },
  withdrawProgramCurrency: {
    withdrawProgramCurrency: {
      defaultResult: 50,
      isFixedAmount: true,
      programCurrencyCode: "POINTS",
      targetIdsToDecrement: ["t1"],
    },
  },
  issueCustomerCoupon: { issueCustomerCoupon: { couponOfferCode: "OFFER1" } },
  useCustomerCoupon: { useCustomerCoupon: { defaultResult: "C1" } },
  holdCustomerCoupon: { holdCustomerCoupon: { defaultResult: "C1" } },
  returnCustomerCoupon: { returnCustomerCoupon: { defaultResult: "C1" } },
  cancelCustomerCoupon: { cancelCustomerCoupon: { couponOfferCode: "OFFER1" } },
  issueCustomerBadge: { issueCustomerBadge: { badgeCode: "VIP" } },
  issueCustomerTier: {
    issueCustomerTier: { tierCode: "GOLD", issueLifetimeTier: false, issueTrialTier: false },
  },
  registerTarget: { registerTarget: { targetCode: "T1" } },
  addCounterData: {
    addCounterData: { defaultResult: 1, isFixedAmount: true, targetCode: "T1", programId: "p1" },
  },
  completeTargetData: { completeTargetData: { targetCode: "T1", programId: "p1" } },
  addCustomerToAudience: { addCustomerToAudience: { customerAudienceCode: "A1" } },
  removeCustomerFromAudience: { removeCustomerFromAudience: { customerAudienceCode: "A1" } },
  metadataTagging: { metadataTagging: { metadataTypeCode: "TYPE", metadataCode: "CODE" } },
  sendNotification: {
    sendNotification: { channelCode: "EMAIL", templateCode: "WELCOME" },
  },
  issueCustomerExternalOffer: { issueCustomerExternalOffer: { offerCode: "EXT1" } },
  cancelCustomerExternalOffer: { cancelCustomerExternalOffer: { offerCode: "EXT1" } },
};

describe("expressionActionSchema", () => {
  it("accepts every one of the 18 corrected actions", () => {
    expect(Object.keys(VALID_ACTIONS).sort()).toEqual([...ACTION_NAMES].sort());
    for (const [name, sample] of Object.entries(VALID_ACTIONS)) {
      expect(expressionActionSchema.safeParse(sample).success, name).toBe(true);
    }
  });

  it("rejects a numeric action missing its required amount fields", () => {
    expect(
      expressionActionSchema.safeParse({ issueProgramCurrency: { programCurrencyCode: "POINTS" } })
        .success
    ).toBe(false);
  });

  it("requires non-empty notification channel and template codes", () => {
    expect(
      expressionActionSchema.safeParse({ sendNotification: { templateCode: "WELCOME" } }).success
    ).toBe(false);
    expect(
      expressionActionSchema.safeParse({
        sendNotification: { channelCode: "EMAIL", templateCode: "" },
      }).success
    ).toBe(false);
  });

  it("accepts only the supported notification kinds", () => {
    for (const kind of ["REMINDER", "NOTIFICATION"]) {
      expect(
        expressionActionSchema.safeParse({
          sendNotification: { channelCode: "EMAIL", templateCode: "WELCOME", kind },
        }).success
      ).toBe(true);
    }
    expect(
      expressionActionSchema.safeParse({
        sendNotification: { channelCode: "EMAIL", templateCode: "WELCOME", kind: "ALERT" },
      }).success
    ).toBe(false);
  });
});

describe("rewardActionSchema (NL → reward scope)", () => {
  it("accepts issue + withdraw program currency", () => {
    expect(rewardActionSchema.safeParse(VALID_ACTIONS.issueProgramCurrency).success).toBe(true);
    expect(rewardActionSchema.safeParse(VALID_ACTIONS.withdrawProgramCurrency).success).toBe(true);
  });

  it("accepts issue customer badge", () => {
    expect(rewardActionSchema.safeParse(VALID_ACTIONS.issueCustomerBadge).success).toBe(true);
  });

  it("accepts an earn-rate action (isFixedAmount:false + path + multiply preOperation)", () => {
    const earnRate = {
      issueProgramCurrency: {
        programCurrencyCode: "POINTS",
        isFixedAmount: false,
        defaultResult: 0,
        path: "$.eventData.orderTotal",
        preOperation: { multiply: { operand: 2 } },
      },
    };
    expect(rewardActionSchema.safeParse(earnRate).success).toBe(true);
  });

  it("structurally rejects every out-of-scope action", () => {
    const rewardNames = new Set<string>(REWARD_ACTION_NAMES);
    for (const name of ACTION_NAMES) {
      if (rewardNames.has(name)) continue;
      expect(rewardActionSchema.safeParse(VALID_ACTIONS[name]).success, name).toBe(false);
    }
  });

  it("names exactly the in-scope reward actions (drift guard)", () => {
    expect([...REWARD_ACTION_NAMES].sort()).toEqual([
      "addCounterData",
      "issueCustomerBadge",
      "issueProgramCurrency",
      "withdrawProgramCurrency",
    ]);
  });
});

describe("rewardActionSchema — narrow reward scope (strips forbidden fields at source)", () => {
  it("strips the id/date/target fields a currency reward must never carry", () => {
    // Every forbidden key here is a DEFINED-optional field on the full action schema,
    // so a plain strip-unknown would keep it. The narrow reward schema declares only
    // the reward vocabulary, so zod drops the rest on parse.
    const parsed = rewardActionSchema.parse({
      issueProgramCurrency: {
        programCurrencyCode: "POINTS",
        isFixedAmount: true,
        defaultResult: 500,
        programId: "prog-1",
        programCode: "PROG",
        badgeId: "badge-1",
        targetIdsToIncrement: ["t1"],
        registerTargets: true,
        pendingDate: "2026-01-01",
        expiryDate: "2026-02-01",
        cappedResult: 10,
        roundingAlgorithm: "ROUND_HALF_UP",
        decimalPlaces: 2,
        synchronous: true,
      },
    }) as { issueProgramCurrency: Record<string, unknown> };
    const body = parsed.issueProgramCurrency;
    expect(body).toEqual({
      programCurrencyCode: "POINTS",
      isFixedAmount: true,
      defaultResult: 500,
    });
    for (const forbidden of [
      "programId",
      "programCode",
      "badgeId",
      "targetIdsToIncrement",
      "registerTargets",
      "pendingDate",
      "expiryDate",
      "cappedResult",
      "roundingAlgorithm",
      "decimalPlaces",
      "synchronous",
    ]) {
      expect(body, forbidden).not.toHaveProperty(forbidden);
    }
  });

  it("keeps the earn-rate fields (path + preOperation) a currency reward legitimately emits", () => {
    const parsed = rewardActionSchema.parse({
      issueProgramCurrency: {
        programCurrencyCode: "POINTS",
        isFixedAmount: false,
        defaultResult: 0,
        path: "$.eventData.orderTotal",
        preOperation: { multiply: { operand: 2 } },
      },
    }) as { issueProgramCurrency: Record<string, unknown> };
    expect(parsed.issueProgramCurrency).toHaveProperty("path", "$.eventData.orderTotal");
    expect(parsed.issueProgramCurrency).toHaveProperty("preOperation");
  });

  it("strips a badge reward down to its badgeCode (an id-only badge → {}, caught downstream as a no-op)", () => {
    const parsed = rewardActionSchema.parse({
      issueCustomerBadge: {
        badgeId: "badge-uuid-1",
        dateTimePeriod: { startDateTime: "x" },
        synchronous: true,
      },
    }) as { issueCustomerBadge: Record<string, unknown> };
    // badgeCode stays OPTIONAL: a code-less badge parses; grounding rejects the no-op.
    expect(parsed.issueCustomerBadge).toEqual({});
  });

  it("keeps a badge reward's badgeCode", () => {
    const parsed = rewardActionSchema.parse({
      issueCustomerBadge: { badgeCode: "VIP" },
    }) as { issueCustomerBadge: Record<string, unknown> };
    expect(parsed.issueCustomerBadge).toEqual({ badgeCode: "VIP" });
  });

  it("strips forbidden fields from a withdraw currency reward too (shares the currency shape)", () => {
    // withdraw uniquely carries targetIdsToDecrement/Increment on the full schema — the
    // exact id/target fields the narrow reward shape must drop.
    const parsed = rewardActionSchema.parse({
      withdrawProgramCurrency: {
        programCurrencyCode: "POINTS",
        isFixedAmount: true,
        defaultResult: 50,
        targetIdsToDecrement: ["t1"],
        targetIdsToIncrement: ["t2"],
        programId: "p1",
        synchronous: true,
      },
    }) as { withdrawProgramCurrency: Record<string, unknown> };
    expect(parsed.withdrawProgramCurrency).toEqual({
      programCurrencyCode: "POINTS",
      isFixedAmount: true,
      defaultResult: 50,
    });
  });
});

describe("reward grounding SSOT (cross-service key drift guard)", () => {
  it("names exactly the reward context keys", () => {
    expect([...REWARD_CONTEXT_KEYS]).toEqual(["currencies", "badges", "targets"]);
  });

  it("maps every reward action to a grounding row", () => {
    // Compile-enforced by `Record<RewardActionName, …>`; asserted at runtime too so a
    // hand-edit widening the type can't silently drop a reward action's grounding.
    expect(Object.keys(REWARD_ACTION_GROUNDING).sort()).toEqual([...REWARD_ACTION_NAMES].sort());
  });

  it("grounds each reward action against a real context key and a non-empty field", () => {
    const keys = new Set<string>(REWARD_CONTEXT_KEYS);
    for (const [name, { field, contextKey }] of Object.entries(REWARD_ACTION_GROUNDING)) {
      expect(field.length, name).toBeGreaterThan(0);
      expect(keys.has(contextKey), `${name}.contextKey`).toBe(true);
    }
  });

  it("grounds each reward action on a field the full backend-accurate action schema really has", () => {
    // The narrow reward schemas fork field names from the full action schemas, and
    // REWARD_ACTION_GROUNDING.field is an untyped string. Pin each `field` to the full
    // schema so a wire rename can't leave grounding reading a nonexistent property
    // (which would look like a missing code → repair/abstain on a valid reward).
    for (const [name, { field }] of Object.entries(REWARD_ACTION_GROUNDING)) {
      const valid = VALID_ACTIONS[name] as Record<string, Record<string, unknown>>;
      const withField = { [name]: { ...valid[name], [field]: "SAMPLE_CODE" } };
      const parsed = expressionActionSchema.parse(withField) as Record<
        string,
        Record<string, unknown>
      >;
      // The full schema strips unknown keys, so the field surviving proves it is real.
      expect(parsed[name], `${name}.${field}`).toHaveProperty(field, "SAMPLE_CODE");
    }
  });
});

// -----------------------------------------------------------------------------
// Operators (the recursive tree)
// -----------------------------------------------------------------------------

const VALID_OPERATORS: Record<string, unknown> = {
  and: { and: { children: [LEAF] } },
  or: { or: { children: [LEAF] } },
  not: { not: { children: [LEAF] } },
  equals: {
    equals: { path: "$.x", value: "a", extractValueFromPath: false, defaultResult: false },
  },
  notEquals: {
    notEquals: { path: "$.x", value: "a", extractValueFromPath: false, defaultResult: false },
  },
  greaterThan: { greaterThan: { path: "$.amount", value: 100, extractValueFromPath: false } },
  greaterThanEquals: {
    greaterThanEquals: { path: "$.amount", value: 100, extractValueFromPath: false },
  },
  lessThan: { lessThan: { path: "$.amount", value: 100, extractValueFromPath: false } },
  lessThanEquals: { lessThanEquals: { path: "$.amount", value: 100, extractValueFromPath: false } },
  between: {
    between: { path: "$.amount", lowerBound: 0, upperBound: 100, extractValueFromPath: false },
  },
  startsWith: {
    startsWith: { path: "$.name", value: "A", ignoreCase: false, extractValueFromPath: false },
  },
  endsWith: {
    endsWith: { path: "$.name", value: "Z", ignoreCase: false, extractValueFromPath: false },
  },
  matches: {
    matches: { path: "$.name", value: ".*", ignoreCase: false, extractValueFromPath: false },
  },
  empty: { empty: { path: "$.x" } },
  notEmpty: { notEmpty: { path: "$.x" } },
  in: { in: { path: "$.x", values: ["a"], extractValues: false } },
  notIn: { notIn: { path: "$.x", values: ["a"], extractValues: false } },
  containsAny: { containsAny: { path: "$.x", values: ["a"], extractValues: false } },
  containsAll: { containsAll: { path: "$.x", values: ["a"], extractValues: false } },
  exists: { exists: { path: "$.x" } },
  notExists: { notExists: { path: "$.x" } },
  true: { true: {} },
  hasBadge: { hasBadge: { badgeId: "VIP", revalidateBadge: false } },
  currentTier: {
    currentTier: { validateLifetimeTier: false, validateTrialTier: false, revalidateTier: false },
  },
  targetCompleted: { targetCompleted: { targetId: "t1", revalidateTarget: false } },
  hasProgramCurrency: { hasProgramCurrency: { programCurrencyCode: "POINTS" } },
  eventCount: { eventCount: { eventTypeCode: "purchase", minCount: 3 } },
  eventSum: { eventSum: { eventTypeCode: "purchase", fieldPath: "$.amount", minSum: 100 } },
  eventExists: { eventExists: { eventTypeCode: "purchase" } },
  lastEventTime: { lastEventTime: { eventTypeCode: "purchase", maxDaysSinceLast: 30 } },
  funnelStage: { funnelStage: { stage: "CONVERSION" } },
  isMetadataType: {
    isMetadataType: { path: "$.eventData.STORE", metadataTypeCode: "STORE" },
  },
  inMetadataGroup: {
    inMetadataGroup: {
      path: "$.eventData.STORE",
      metadataGroupCode: "FLAGSHIPS",
      metadataTypeCode: "STORE",
    },
  },
  isChildMetadata: {
    isChildMetadata: {
      path: "$.eventData.STORE",
      metadataTypeCode: "STORE",
      parentTypeCode: "REGION",
      parentCode: "WEST",
      directOnly: false,
    },
  },
};

describe("expressionSchema", () => {
  it("accepts every one of the 34 corrected operators", () => {
    expect(Object.keys(VALID_OPERATORS).sort()).toEqual([...ALL_OPERATORS].sort());
    for (const [name, sample] of Object.entries(VALID_OPERATORS)) {
      expect(expressionSchema.safeParse(sample).success, name).toBe(true);
    }
  });

  describe("metadata-hierarchy operators (backend IsMetadata/InMetadataGroup/IsChildMetadataExpression)", () => {
    // JSON shapes copied from the backend @JsonTypeName ids and fields.
    const BACKEND_JSON = {
      isMetadataType: {
        isMetadataType: {
          path: "$.eventData.STORE",
          metadataTypeCode: "REGION",
          metadataCode: "WEST",
          defaultResult: false,
        },
      },
      inMetadataGroup: {
        inMetadataGroup: {
          path: "$.eventData.STORE",
          metadataGroupCode: "FLAGSHIPS",
          metadataTypeCode: "STORE",
          defaultResult: false,
        },
      },
      isChildMetadata: {
        isChildMetadata: {
          path: "$.eventData.STORE",
          metadataTypeCode: "STORE",
          parentTypeCode: "REGION",
          parentCode: "WEST",
          directOnly: true,
          defaultResult: false,
        },
      },
    } as const;

    for (const [name, json] of Object.entries(BACKEND_JSON)) {
      it(`round-trips ${name} without dropping or renaming fields`, () => {
        const parsed = expressionSchema.parse(json);
        expect(JSON.parse(JSON.stringify(parsed))).toEqual(json);
        expect(conditionExpressionSchema.parse(json)).toEqual(json);
      });
    }

    it("requires the parent node on isChildMetadata", () => {
      expect(
        expressionSchema.safeParse({
          isChildMetadata: { path: "$.x", metadataTypeCode: "STORE", parentTypeCode: "REGION" },
        }).success
      ).toBe(false);
    });

    it("requires the group code on inMetadataGroup", () => {
      expect(
        expressionSchema.safeParse({
          inMetadataGroup: { path: "$.x", metadataTypeCode: "STORE", metadataGroupCode: "" },
        }).success
      ).toBe(false);
    });
  });

  it("rejects the pre-drift `between` shape (minValue/maxValue)", () => {
    expect(
      expressionSchema.safeParse({
        between: { path: "$.x", minValue: 0, maxValue: 100, extractValueFromPath: false },
      }).success
    ).toBe(false);
  });

  it("accepts a numeric comparison whose `value` is a JsonPath string when extracting from path", () => {
    // The comparand is `number | string`: a path-extracted comparison keeps the
    // JsonPath string (it must not be coerced to NaN).
    expect(
      expressionSchema.safeParse({
        greaterThan: { path: "$.amount", value: "$.threshold", extractValueFromPath: true },
      }).success
    ).toBe(true);
  });

  it("treats equals/notEquals `value` as optional (matches z.unknown() inference)", () => {
    // Type-level assertion: an omitted `value` compiles against the declared type.
    const omitted: Expression = {
      equals: { path: "$.x", extractValueFromPath: false, defaultResult: false },
    };
    expect(expressionSchema.safeParse(omitted).success).toBe(true);
    expect(
      expressionSchema.safeParse({
        notEquals: { path: "$.x", extractValueFromPath: false, defaultResult: false },
      }).success
    ).toBe(true);
  });

  it("rejects a non-JsonPath path", () => {
    expect(
      expressionSchema.safeParse({
        equals: { path: "amount", value: 1, extractValueFromPath: false, defaultResult: false },
      }).success
    ).toBe(false);
  });

  describe("equals/notEquals preOperation (Unit 5, R3)", () => {
    // Real shape confirmed via the persisted `birthday` segment's stored
    // expression — the backend accepts and round-trips this even though the
    // visual builder doesn't yet expose PreOperationSelector for this operator.
    const birthdayShape = {
      equals: {
        path: "$.birthDate",
        value: true,
        extractValueFromPath: false,
        defaultResult: false,
        preOperation: { matchesCurrentDate: { timeZone: "ORGANIZATION" } },
      },
    };

    it("accepts an equals node with a matchesCurrentDate preOperation (the real birthday shape)", () => {
      expect(expressionSchema.safeParse(birthdayShape).success).toBe(true);
    });

    it("accepts a notEquals node with a matchesCurrentDate preOperation, symmetric with equals", () => {
      // openapi.yaml declares notEquals.preOperation unconditionally, identical
      // in shape to equals. Its only preOperation-related restriction
      // (x-clickhouse-compilable: "conditional" on PreOperation's
      // matchesCurrentDate variant, scoped to "attached to EqualsExpression")
      // is a ClickHouse-SQL-compiler limitation for the customer/segment
      // surface -- not a schema-level restriction on notEquals accepting
      // preOperation at all. Nothing in this repo enforces that annotation at
      // runtime, and it doesn't apply to the event surface (in-process
      // evaluation, no ClickHouse compile step).
      const parsed = expressionSchema.parse({
        notEquals: {
          path: "$.birthDate",
          value: true,
          extractValueFromPath: false,
          defaultResult: false,
          preOperation: { matchesCurrentDate: { timeZone: "ORGANIZATION" } },
        },
      }) as { notEquals: Record<string, unknown> };
      expect(parsed.notEquals).toHaveProperty("preOperation");
    });

    it("still accepts equals/notEquals without preOperation (no regression)", () => {
      expect(expressionSchema.safeParse(VALID_OPERATORS.equals).success).toBe(true);
      expect(expressionSchema.safeParse(VALID_OPERATORS.notEquals).success).toBe(true);
    });

    it("round-trips the birthday shape without silently stripping preOperation", () => {
      const parsed = expressionSchema.parse(birthdayShape) as {
        equals: { preOperation?: unknown };
      };
      expect(parsed.equals).toHaveProperty("preOperation");
      expect(parsed.equals.preOperation).toEqual({
        matchesCurrentDate: { timeZone: "ORGANIZATION" },
      });
    });
  });

  describe("jsonPathSchema placeholder-path backstop (Unit 4, R2a) -- schema-layer coverage", () => {
    // Mirrors packages/ui's utils.validation.test.ts coverage for the equivalent
    // check, but at the Zod-schema layer itself (previously untested here at all
    // -- code review finding). This schema's real runtime caller today is
    // apps/ai-server's eval suite, not the Hub UI's interactive Save path.
    it("still accepts a fully-specified path (no regression)", () => {
      expect(
        expressionSchema.safeParse({
          exists: { path: "$.eventData.order.total" },
        }).success
      ).toBe(true);
    });

    it("rejects a bare '$.' placeholder path", () => {
      expect(expressionSchema.safeParse({ exists: { path: "$." } }).success).toBe(false);
    });

    it("rejects a bare '$.eventData.' placeholder path", () => {
      expect(
        expressionSchema.safeParse({
          equals: {
            path: "$.eventData.",
            value: 1,
            extractValueFromPath: false,
            defaultResult: false,
          },
        }).success
      ).toBe(false);
    });

    it("does not reject a path whose only segment happens to share a name with an operator -- that's PropertyPicker's live-resolution job, not this backstop's", () => {
      expect(
        expressionSchema.safeParse({
          exists: { path: "$.funnelStage" },
        }).success
      ).toBe(true);
    });
  });

  it("rejects an unknown operator name", () => {
    expect(expressionSchema.safeParse({ nonsense: {} }).success).toBe(false);
  });

  it("requires composite operators to have at least one child", () => {
    expect(expressionSchema.safeParse({ and: { children: [] } }).success).toBe(false);
  });

  it("validates a deep nested tree with attached actions", () => {
    const tree = {
      and: {
        children: [
          { greaterThan: { path: "$.amount", value: 100, extractValueFromPath: false } },
          {
            or: {
              children: [
                { hasBadge: { badgeId: "VIP", revalidateBadge: false } },
                {
                  between: {
                    path: "$.items",
                    lowerBound: 3,
                    upperBound: 10,
                    extractValueFromPath: false,
                  },
                },
              ],
            },
          },
        ],
        actions: [
          {
            issueProgramCurrency: {
              defaultResult: 500,
              isFixedAmount: true,
              programCurrencyCode: "POINTS",
            },
          },
        ],
      },
    };
    expect(expressionSchema.safeParse(tree).success).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// Condition-only schema (the WHEN scope — same operators, no nested actions)
// -----------------------------------------------------------------------------

describe("conditionExpressionSchema", () => {
  it("accepts every operator tree the full schema accepts (identical operator set)", () => {
    // The recursive operator set is identical to the full schema; only the nested
    // `actions` field is dropped. So every one of the 34 operators must parse.
    for (const [name, sample] of Object.entries(VALID_OPERATORS)) {
      expect(conditionExpressionSchema.safeParse(sample).success, name).toBe(true);
    }
  });

  it("strips a nested `actions` array that the full schema keeps (the defining difference)", () => {
    // The ONE behavioral difference from the full schema: a composite's `actions`
    // field is omitted, so zod strips a nested actions array under the condition
    // schema while the full schema keeps + validates it. Assert the parsed output
    // directly — a `.success` reject fixture can't reach this (unknown keys are
    // stripped, not rejected).
    const withActions = {
      and: { children: [LEAF], actions: [VALID_ACTIONS.issueProgramCurrency] },
    };
    const condition = conditionExpressionSchema.parse(withActions) as {
      and: { actions?: unknown };
    };
    const full = expressionSchema.parse(withActions) as { and: { actions?: unknown } };
    expect(condition.and.actions).toBeUndefined();
    expect(full.and.actions).toBeDefined();
  });

  it("rejects a bare top-level action wrapper (an action is never a top-level operator)", () => {
    // Orthogonal guard: an action wrapper matches no operator union key, so it is
    // rejected outright (true of both schemas — see the strip test above for the
    // condition-vs-full difference).
    for (const name of ACTION_NAMES) {
      expect(conditionExpressionSchema.safeParse(VALID_ACTIONS[name]).success, name).toBe(false);
    }
  });
});
