/**
 * Tests for the program-scoped `eventTypeCode` construction in
 * `buildEventRule` (Award Rule Templates).
 *
 * Regression coverage for a bug where 4 call sites built a scoped event
 * type by concatenating `context.programCode` directly with a suffix
 * (e.g. `${programCode}.purchase`), keeping any dashes in the program
 * code. Every program code in this codebase is kebab-case (e.g.
 * "cafe-rewards"), but the platform's event-type-code convention requires
 * the scope-prefix segment to contain letters only — see
 * `sanitizeProgramCodeForEventType` in ./execution-helpers, the same
 * converter already used for this exact purpose everywhere else in this
 * package. A rule built with the dashed form is accepted (published,
 * correct action shape, real programId) but would silently never fire,
 * since no submitted event actually carries that exact event-type code.
 */
import { describe, expect, it } from "vitest";

import type { AWARD_RULE_TEMPLATES } from "./templates";
import { getTemplateById } from "./templates";

type BuildContext = Parameters<(typeof AWARD_RULE_TEMPLATES)[number]["buildEventRule"]>[1];

const dashedCtx: BuildContext = {
  programId: "prog-123",
  currencyId: "curr-456",
  currencyCode: "POINTS",
  programCode: "cafe-rewards",
};

describe("buildEventRule: program-scoped eventTypeCode strips dashes", () => {
  it("points-per-dollar scopes to the dash-stripped program code", () => {
    const template = getTemplateById("points-per-dollar")!;
    const rule = template.buildEventRule(template.defaultConfig, dashedCtx);
    expect(rule.eventTypeCode).toBe("caferewards.purchase");
  });

  it("points-per-purchase scopes to the dash-stripped program code", () => {
    const template = getTemplateById("points-per-purchase")!;
    const rule = template.buildEventRule(template.defaultConfig, dashedCtx);
    expect(rule.eventTypeCode).toBe("caferewards.purchase");
  });

  it("recurring-visit scopes to the dash-stripped program code", () => {
    const template = getTemplateById("recurring-visit")!;
    const rule = template.buildEventRule(template.defaultConfig, dashedCtx);
    expect(rule.eventTypeCode).toBe("caferewards.visit");
  });

  it("customEvent falls back to the dash-stripped program code when context.eventTypeCode is absent", () => {
    const template = getTemplateById("customEvent")!;
    const rule = template.buildEventRule(template.defaultConfig, dashedCtx);
    expect(rule.eventTypeCode).toBe("caferewards.custom");
  });

  it("customEvent still prefers an explicit context.eventTypeCode over the scoped fallback", () => {
    const template = getTemplateById("customEvent")!;
    const rule = template.buildEventRule(template.defaultConfig, {
      ...dashedCtx,
      eventTypeCode: "some.explicit.code",
    });
    expect(rule.eventTypeCode).toBe("some.explicit.code");
  });

  it("falls back to the bare, unscoped suffix when no programCode is provided at all (unchanged behavior)", () => {
    const noProgramCodeCtx: BuildContext = { programId: "prog-123", currencyCode: "POINTS" };

    expect(
      getTemplateById("points-per-dollar")!.buildEventRule(
        { pointsPerDollar: 10 },
        noProgramCodeCtx
      ).eventTypeCode
    ).toBe("purchase");
    expect(
      getTemplateById("recurring-visit")!.buildEventRule(
        { pointsPerVisit: 25, visitThreshold: 5 },
        noProgramCodeCtx
      ).eventTypeCode
    ).toBe("visit");
    expect(
      getTemplateById("customEvent")!.buildEventRule({ pointsPerEvent: 100 }, noProgramCodeCtx)
        .eventTypeCode
    ).toBe("custom");
  });

  it("a non-dashed program code is unaffected (sanitization is a no-op)", () => {
    const plainCtx: BuildContext = {
      programId: "prog-123",
      currencyCode: "POINTS",
      programCode: "caferewards",
    };
    expect(
      getTemplateById("points-per-dollar")!.buildEventRule({ pointsPerDollar: 10 }, plainCtx)
        .eventTypeCode
    ).toBe("caferewards.purchase");
  });
});

describe("buildEventRule: tier target wiring", () => {
  const templateConfigs: Array<[string, Record<string, unknown>]> = [
    ["points-per-dollar", { pointsPerDollar: 10 }],
    ["points-per-purchase", { pointsPerPurchase: 50 }],
    ["signup-bonus", { bonusPoints: 100 }],
    ["birthday-bonus", { bonusPoints: 200 }],
    ["referral-bonus", { referrerPoints: 500 }],
    ["recurring-visit", { pointsPerVisit: 25, visitThreshold: 5 }],
    ["customEvent", { pointsPerEvent: 100 }],
  ];

  function targetIdsToIncrement(
    rule: ReturnType<(typeof AWARD_RULE_TEMPLATES)[number]["buildEventRule"]>
  ): string[] | undefined {
    return (
      rule.eventActionsExpression?.true?.actions[0] as {
        issueProgramCurrency?: { targetIdsToIncrement?: string[] };
      }
    )?.issueProgramCurrency?.targetIdsToIncrement;
  }

  for (const [templateId, config] of templateConfigs) {
    it(`${templateId} passes tier target IDs into issueProgramCurrency`, () => {
      const template = getTemplateById(templateId)!;
      const rule = template.buildEventRule(config, {
        ...dashedCtx,
        tierTargetIds: ["target-silver", "target-gold"],
      });

      expect(targetIdsToIncrement(rule)).toEqual(["target-silver", "target-gold"]);
    });

    it(`${templateId} falls back to no tier targets`, () => {
      const template = getTemplateById(templateId)!;
      const rule = template.buildEventRule(config, dashedCtx);

      expect(targetIdsToIncrement(rule)).toEqual([]);
    });
  }
});
