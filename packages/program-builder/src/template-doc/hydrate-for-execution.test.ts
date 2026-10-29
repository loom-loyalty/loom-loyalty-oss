/**
 * Tests for `hydrateForExecution` — the helper that synthesizes the
 * `awardRule.rulePayload` defaults a parsed-from-markdown spec needs in
 * order to satisfy the executor's structural schema. Previously this
 * synthesis lived inline in `apps/hub/src/features/template-upload/upload-page.tsx`,
 * which meant any other caller (programmatic batch import, MCP tool,
 * alternative ai-server endpoint) had to re-derive the same defaults
 * or the executor would crash with "Invalid input: expected object,
 * received undefined" on rulePayload.
 *
 * Contract:
 *  - Spec with no rulePayload at all → fully synthesized defaults
 *  - Spec with partial rulePayload (some fields set) → preserve user-supplied
 *    fields, fill in only the missing ones
 *  - Spec with full rulePayload → idempotent (returns equivalent shape)
 *  - Spec with no `program.code` → throws (can't synthesize without a source)
 */

import { describe, expect, it } from "vitest";

import type { ProgramSpec } from "../spec";
import { hydrateForExecution } from "./hydrate-for-execution";

function baseSpec(): ProgramSpec {
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
    currency: { code: "test-pts", name: "Points", currencyTypeCode: "points" },
    tiers: [],
    badges: [],
    awardRule: {
      templateId: "points-per-dollar",
      templateConfig: { pointsPerDollar: 1 },
      // rulePayload intentionally omitted in baseSpec — each test sets it
      rulePayload: undefined as unknown as ProgramSpec["awardRule"]["rulePayload"],
    },
  };
}

describe("hydrateForExecution", () => {
  it("synthesizes full rulePayload defaults using the template's display name", () => {
    const spec = baseSpec();
    const out = hydrateForExecution(spec);
    expect(out.awardRule.rulePayload).toEqual({
      code: "test-rewards-earn",
      // Pulled from `getTemplateById("points-per-dollar").name` — this is
      // the same pattern the wizard uses in award-rule-step.tsx:99-100,
      // and it avoids the "Test Rewards Rewards" doubling that an earlier
      // hardcoded-"Rewards" draft produced.
      name: "Test Rewards Points per Dollar Spent",
      category: "ORGANIZATION_DEFINED",
    });
  });

  it("preserves user-supplied code, fills name + category", () => {
    const spec = baseSpec();
    spec.awardRule.rulePayload = {
      code: "custom-earn-code",
    } as unknown as ProgramSpec["awardRule"]["rulePayload"];
    const out = hydrateForExecution(spec);
    expect(out.awardRule.rulePayload).toEqual({
      code: "custom-earn-code",
      name: "Test Rewards Points per Dollar Spent",
      category: "ORGANIZATION_DEFINED",
    });
  });

  it("preserves user-supplied name, fills code + category", () => {
    const spec = baseSpec();
    spec.awardRule.rulePayload = {
      name: "Custom Rule Name",
    } as unknown as ProgramSpec["awardRule"]["rulePayload"];
    const out = hydrateForExecution(spec);
    expect(out.awardRule.rulePayload).toEqual({
      code: "test-rewards-earn",
      name: "Custom Rule Name",
      category: "ORGANIZATION_DEFINED",
    });
  });

  it("preserves user-supplied category, fills code + name", () => {
    const spec = baseSpec();
    spec.awardRule.rulePayload = {
      category: "PROMOTION",
    } as unknown as ProgramSpec["awardRule"]["rulePayload"];
    const out = hydrateForExecution(spec);
    expect(out.awardRule.rulePayload).toEqual({
      code: "test-rewards-earn",
      name: "Test Rewards Points per Dollar Spent",
      category: "PROMOTION",
    });
  });

  it("falls back to '${programName} Rewards' when the templateId is unknown", () => {
    const spec = baseSpec();
    spec.awardRule.templateId = "nonexistent-template-id";
    const out = hydrateForExecution(spec);
    expect((out.awardRule.rulePayload as { name: string }).name).toBe("Test Rewards Rewards");
  });

  it("preserves all three when fully provided (idempotent)", () => {
    const spec = baseSpec();
    spec.awardRule.rulePayload = {
      code: "explicit-code",
      name: "Explicit Name",
      category: "PROMOTION",
    } as unknown as ProgramSpec["awardRule"]["rulePayload"];
    const out = hydrateForExecution(spec);
    expect(out.awardRule.rulePayload).toEqual({
      code: "explicit-code",
      name: "Explicit Name",
      category: "PROMOTION",
    });

    // Round-trip stability: hydrating an already-hydrated spec is a no-op.
    const out2 = hydrateForExecution(out);
    expect(out2.awardRule.rulePayload).toEqual(out.awardRule.rulePayload);
  });

  it("does not mutate the input spec (returns a new object)", () => {
    const spec = baseSpec();
    const before = JSON.stringify(spec);
    hydrateForExecution(spec);
    expect(JSON.stringify(spec)).toBe(before);
  });

  it("preserves all unrelated spec fields untouched", () => {
    const spec = baseSpec();
    spec.tiers = [{ code: "gold", name: "Gold", pointsThreshold: 1000 }];
    spec.testCustomer = {
      email: "t@example.com",
      firstName: "T",
      lastName: "U",
      externalId: "ext-1",
    };
    const out = hydrateForExecution(spec);
    expect(out.tiers).toEqual(spec.tiers);
    expect(out.testCustomer).toEqual(spec.testCustomer);
    expect(out.program).toEqual(spec.program);
    expect(out.currency).toEqual(spec.currency);
    expect(out.selectedFeatures).toEqual(spec.selectedFeatures);
  });

  it("throws when program.code is missing — can't synthesize a code without a source", () => {
    const spec = baseSpec();
    spec.program.code = undefined as unknown as string;
    expect(() => hydrateForExecution(spec)).toThrow(/program\.code/);
  });

  it("throws when program.name is missing — can't synthesize the rule name without a source", () => {
    const spec = baseSpec();
    spec.program.name = undefined as unknown as string;
    expect(() => hydrateForExecution(spec)).toThrow(/program\.name/);
  });

  it("preserves extra rulePayload fields the executor passes through", () => {
    const spec = baseSpec();
    spec.awardRule.rulePayload = {
      code: "custom",
      // Caller may add forward-compat fields; helper preserves them.
      description: "Earn rewards on every purchase",
      tags: ["loyalty", "earn"],
    } as unknown as ProgramSpec["awardRule"]["rulePayload"];
    const out = hydrateForExecution(spec);
    const payload = out.awardRule.rulePayload as Record<string, unknown>;
    expect(payload.description).toBe("Earn rewards on every purchase");
    expect(payload.tags).toEqual(["loyalty", "earn"]);
    expect(payload.code).toBe("custom");
    expect(payload.name).toBe("Test Rewards Points per Dollar Spent");
    expect(payload.category).toBe("ORGANIZATION_DEFINED");
  });
});
