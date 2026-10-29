import type { CreateCustomer } from "@loom-loyalty/sdk";
import { describe, expect, it } from "vitest";

import {
  buildCustomerPayload,
  buildTestEventData,
  generateCode,
  generateCurrencyFields,
  generateEventRuleFields,
  generateExpiryRuleFields,
  generatePendingRuleFields,
} from "./api-converters";
import { RESOURCE_CODE_PATTERN } from "./execution-helpers";
import type { ProgramSpec } from "./spec";

function specWithTestCustomer(): ProgramSpec {
  return {
    selectedFeatures: {
      programCurrency: true,
      expiry: false,
      pending: false,
      tiers: false,
      badges: false,
      programType: "transactional",
      signupBonus: false,
      birthdayBonus: false,
    },
    program: { code: "test-rewards", name: "Test Rewards", typeCode: "standard" },
    currency: { code: "test-points", name: "Test Points", currencyTypeCode: "points" },
    tiers: [],
    badges: [],
    metadata: [],
    awardRule: {
      templateId: "points-per-dollar",
      templateConfig: {},
      rulePayload: {},
    },
    testCustomer: {
      email: "test@example.com",
      firstName: "Test",
      lastName: "Customer",
      externalId: "test-customer",
    },
  };
}

describe("buildCustomerPayload", () => {
  it("creates an active program enrollment that satisfies CreateCustomer", () => {
    const payload: CreateCustomer = buildCustomerPayload(specWithTestCustomer(), "pgm_123");

    expect(payload.programs).toEqual([
      {
        programId: "pgm_123",
        customerProgramStatusCode: "ACTIVE",
      },
    ]);
  });
});

describe("buildTestEventData", () => {
  it("keeps custom-event bodies free of fields outside their strict schema", () => {
    const eventData = buildTestEventData("customEvent", "customer-123", {});

    expect(eventData).not.toHaveProperty("customerId");
    expect(eventData).not.toHaveProperty("eventType");
  });

  // Regression: the transactional data model requires transactionId/
  // transactionDateTime as real elements (see runCreatingEventType) and the
  // real, live-proven purchase-event shape nests the spend under
  // eligibleAmount, never a bare top-level "amount" (see
  // demo-dataset-generator's buildPurchaseEvent). A bare `amount` test event
  // 400s against the platform (`required property 'transactionId' not
  // found`) and, even if it didn't, wouldn't exercise the fixed
  // eligibleAmount.amount-reading reward rules at all.
  it("shapes a purchase test event like a real transactional purchase event", () => {
    const eventData = buildTestEventData("points-per-dollar", "customer-123", {});

    expect(eventData).toMatchObject({
      transactionId: expect.any(String),
      transactionDateTime: expect.any(String),
      eligibleAmount: { amount: expect.any(Number), currencyTypeCode: expect.any(String) },
    });
    expect(eventData).not.toHaveProperty("amount");
  });

  // Regression: "visit" (recurring-visit template) builds its DataModel
  // through the same transactional branch of runCreatingEventType as
  // "purchase" -- transactionId/transactionDateTime are required there
  // regardless of which template triggered it, so a visit test event needs
  // them too. Unlike purchase, recurring-visit's award rule never reads
  // eligibleAmount (it's a flat pointsPerVisit via `eventExpression: {
  // true: {} }`, see templates.ts), so this shape omits it. The old
  // customerId/timestamp/eventType/locationId fields aren't declared
  // anywhere on that DataModel either, so the platform's strict
  // no-additional-properties schema would reject them same as a stray
  // eligibleAmount does on a custom-event schema.
  it("shapes a visit test event like a real transactional visit event", () => {
    const eventData = buildTestEventData("recurring-visit", "customer-123", {});

    expect(eventData).toMatchObject({
      transactionId: expect.any(String),
      transactionDateTime: expect.any(String),
    });
    expect(eventData).not.toHaveProperty("customerId");
    expect(eventData).not.toHaveProperty("timestamp");
    expect(eventData).not.toHaveProperty("eventType");
    expect(eventData).not.toHaveProperty("locationId");
  });
});

// ---------------------------------------------------------------------------
// generateCode — recurrence guard for the resource-code convention.
//
// The API validates these entity codes (Badge, Tier, Program,
// ProgramCurrency, ExpiryRule, PendingRule, EventRule, ...) with the same
// resource-code pattern as DataModelType. Untested before this: the previous
// implementation stripped leading/trailing hyphens BEFORE truncating to 40
// characters, so a name whose 40th character landed on a hyphen (or one
// that was entirely non-alphanumeric) could produce a trailing-hyphen or
// empty code the API rejects.
// ---------------------------------------------------------------------------
describe("generateCode", () => {
  it("produces the expected kebab-case code for a normal name", () => {
    expect(generateCode("Gold Tier")).toBe("gold-tier");
  });

  it("prefixes when a prefix is given", () => {
    expect(generateCode("Gold Tier", "tier")).toBe("tier-gold-tier");
  });

  it("never returns a trailing hyphen even when truncation would land on one", () => {
    // 39 letters + a space lands the 40th character (index 39) on the
    // hyphen the space becomes, which the old implementation returned as-is.
    const name = `${"a".repeat(39)} b`;
    const code = generateCode(name);
    expect(code.endsWith("-")).toBe(false);
    expect(RESOURCE_CODE_PATTERN.test(code)).toBe(true);
  });

  it("falls back rather than returning an empty code for an all-punctuation name", () => {
    expect(generateCode("!!!")).toBe("generated");
    expect(generateCode("!!!", "tier")).toBe("tier-generated");
  });

  it("produces a pattern-valid code for a range of adversarial names", () => {
    const names = [
      "",
      "   ",
      "---",
      "Gold Tier!!",
      "50% Off",
      "a".repeat(100),
      "Café Münster",
      "Tier — Premium",
    ];
    for (const name of names) {
      expect(RESOURCE_CODE_PATTERN.test(generateCode(name)), name).toBe(true);
      expect(RESOURCE_CODE_PATTERN.test(generateCode(name, "prefix")), name).toBe(true);
    }
  });
});

describe("composite code generators stay pattern-valid regardless of programCode's origin", () => {
  // programCode is NOT guaranteed to have come through generateCode()'s
  // 40-char cap. program-step.tsx's manual "Program Code" <Input> only
  // sanitizes the charset (`.replace(/[^a-z0-9-]/g, "")`) and
  // programStepSchema.code in spec.ts only enforces `.min(3)` — neither caps
  // length. A hand-typed programCode can be arbitrarily long and still pass
  // every client-side check before reaching these generators, so the guard
  // has to hold for that path too, not just the auto-generated one.
  const autoGeneratedProgramCode = generateCode("a".repeat(100));
  const handTypedProgramCode = "a".repeat(120); // charset-valid, never length-capped

  for (const programCode of [autoGeneratedProgramCode, handTypedProgramCode]) {
    it(`generateExpiryRuleFields (programCode.length=${programCode.length})`, () => {
      const { code } = generateExpiryRuleFields(programCode, "Program");
      expect(RESOURCE_CODE_PATTERN.test(code)).toBe(true);
    });

    it(`generatePendingRuleFields (programCode.length=${programCode.length})`, () => {
      const { code } = generatePendingRuleFields(programCode, "Program");
      expect(RESOURCE_CODE_PATTERN.test(code)).toBe(true);
    });

    it(`generateCurrencyFields (programCode.length=${programCode.length})`, () => {
      const { code } = generateCurrencyFields(programCode, "Program");
      expect(RESOURCE_CODE_PATTERN.test(code)).toBe(true);
    });

    it(`generateEventRuleFields (programCode.length=${programCode.length})`, () => {
      const { code } = generateEventRuleFields(programCode, "points-per-purchase");
      expect(RESOURCE_CODE_PATTERN.test(code)).toBe(true);
    });
  }
});
