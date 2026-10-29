import { describe, expect, it } from "vitest";

import { getActionCategoryColor } from "./action-category-colors";
import type { Expression } from "./types";
import {
  ACTION_CATEGORIES,
  ACTION_TYPE_NAMES,
  createDefaultAction,
  createDefaultExpression,
  validateExpressionTree,
} from "./utils";

function errors(expr: Expression): string[] {
  return validateExpressionTree(expr)
    .filter((e) => e.severity === "error")
    .map((e) => `${e.field}:${e.message}`);
}

describe("validateExpressionTree — per-operator rules", () => {
  describe("comparison ops require path AND (value OR extractValueFromPath)", () => {
    it("flags equals with empty value and extractValueFromPath false", () => {
      const expr: Expression = {
        equals: { path: "$.x", value: "", extractValueFromPath: false, defaultResult: false },
      };
      expect(errors(expr).length).toBeGreaterThan(0);
    });

    it("passes equals with non-empty value", () => {
      const expr: Expression = {
        equals: { path: "$.x", value: "y", extractValueFromPath: false, defaultResult: false },
      };
      expect(errors(expr)).toEqual([]);
    });

    it("passes equals with empty value when extractValueFromPath true", () => {
      const expr: Expression = {
        equals: { path: "$.x", value: "", extractValueFromPath: true, defaultResult: false },
      };
      expect(errors(expr)).toEqual([]);
    });

    it("flags greaterThan with null value and extractValueFromPath false", () => {
      const expr: Expression = {
        greaterThan: { path: "$.x", value: null, extractValueFromPath: false },
      } as unknown as Expression;
      expect(errors(expr).length).toBeGreaterThan(0);
    });

    it("flags startsWith with missing value", () => {
      const expr: Expression = {
        startsWith: { path: "$.x", value: "", ignoreCase: false, extractValueFromPath: false },
      };
      expect(errors(expr).length).toBeGreaterThan(0);
    });

    it("flags equals with missing path", () => {
      const expr: Expression = {
        equals: { path: "", value: "y", extractValueFromPath: false, defaultResult: false },
      };
      expect(errors(expr).length).toBeGreaterThan(0);
    });
  });

  describe("between requires both lowerBound and upperBound when not extracting", () => {
    it("flags between with missing upperBound and extractValueFromPath false", () => {
      const expr: Expression = {
        between: { path: "$.x", lowerBound: 0, upperBound: null, extractValueFromPath: false },
      } as unknown as Expression;
      expect(errors(expr).length).toBeGreaterThan(0);
    });

    it("passes between with both bounds present", () => {
      const expr: Expression = {
        between: { path: "$.x", lowerBound: 0, upperBound: 10, extractValueFromPath: false },
      };
      expect(errors(expr)).toEqual([]);
    });
  });

  describe("collection ops require non-empty values OR extractValues true", () => {
    it("flags in with empty values and extractValues false", () => {
      const expr: Expression = { in: { path: "$.x", values: [], extractValues: false } };
      expect(errors(expr).length).toBeGreaterThan(0);
    });

    it("passes in with non-empty values", () => {
      const expr: Expression = { in: { path: "$.x", values: ["a"], extractValues: false } };
      expect(errors(expr)).toEqual([]);
    });

    it("passes containsAny when extractValues true and values empty", () => {
      const expr: Expression = {
        containsAny: { path: "$.x", values: [], extractValues: true },
      };
      expect(errors(expr)).toEqual([]);
    });
  });

  describe("empty/notEmpty/exists/notExists require non-empty path", () => {
    it("flags exists with empty path", () => {
      const expr: Expression = { exists: { path: "" } };
      expect(errors(expr).length).toBeGreaterThan(0);
    });

    it("passes exists with valid path", () => {
      const expr: Expression = { exists: { path: "$.x" } };
      expect(errors(expr)).toEqual([]);
    });
  });

  describe("loyalty ops require their id fields", () => {
    it("flags hasBadge with empty badgeId", () => {
      const expr: Expression = { hasBadge: { badgeId: "", revalidateBadge: false } };
      expect(errors(expr).length).toBeGreaterThan(0);
    });

    it("passes hasBadge with non-empty badgeId", () => {
      const expr: Expression = { hasBadge: { badgeId: "b1", revalidateBadge: false } };
      expect(errors(expr)).toEqual([]);
    });

    it("flags isChildMetadata missing its parent node and accepts a complete one", () => {
      const incomplete = validateExpressionTree(createDefaultExpression("isChildMetadata"));
      const fields = incomplete.map((e) => e.field);
      expect(fields).toEqual(
        expect.arrayContaining(["path", "metadataTypeCode", "parentTypeCode", "parentCode"])
      );
      expect(
        validateExpressionTree({
          isChildMetadata: {
            path: "$.eventData.STORE",
            metadataTypeCode: "STORE",
            parentTypeCode: "REGION",
            parentCode: "WEST",
            directOnly: false,
          },
        })
      ).toEqual([]);
    });

    it("rejects a metadata path outside $.eventData", () => {
      const errors = validateExpressionTree({
        isMetadataType: {
          path: "$.eventTarget.externalId",
          metadataTypeCode: "STORE",
        },
      });
      expect(errors).toEqual([
        expect.objectContaining({
          field: "path",
          message: expect.stringContaining("$.eventData"),
        }),
      ]);
    });

    it("reports only the missing field for the unfinished $.eventData. placeholder", () => {
      const errors = validateExpressionTree({
        isMetadataType: { path: "$.eventData.", metadataTypeCode: "STORE" },
      });
      expect(errors).toEqual([
        expect.objectContaining({ field: "path", message: "Is Metadata needs a field selected." }),
      ]);
    });

    it("flags inMetadataGroup with an empty group code", () => {
      const errors = validateExpressionTree({
        inMetadataGroup: {
          path: "$.eventData.STORE",
          metadataTypeCode: "STORE",
          metadataGroupCode: "",
        },
      });
      expect(errors.map((e) => e.field)).toEqual(["metadataGroupCode"]);
    });

    it("flags currentTier with empty tierCode", () => {
      const expr: Expression = {
        currentTier: {
          tierCode: "",
          validateLifetimeTier: false,
          validateTrialTier: false,
          revalidateTier: false,
        },
      };
      expect(errors(expr).length).toBeGreaterThan(0);
    });

    it("flags targetCompleted with empty targetId", () => {
      const expr: Expression = { targetCompleted: { targetId: "", revalidateTarget: false } };
      expect(errors(expr).length).toBeGreaterThan(0);
    });

    it("flags hasProgramCurrency with empty programCurrencyCode", () => {
      const expr: Expression = { hasProgramCurrency: { programCurrencyCode: "" } };
      expect(errors(expr).length).toBeGreaterThan(0);
    });
  });

  describe("event-behavior ops require their key fields", () => {
    it("flags eventCount with empty eventTypeCode", () => {
      const expr: Expression = { eventCount: { eventTypeCode: "", minCount: 3 } };
      expect(errors(expr).length).toBeGreaterThan(0);
    });

    it("passes eventCount with eventTypeCode and minCount", () => {
      const expr: Expression = { eventCount: { eventTypeCode: "PURCHASE", minCount: 3 } };
      expect(errors(expr)).toEqual([]);
    });

    it("flags eventSum with missing fieldPath", () => {
      const expr: Expression = {
        eventSum: { eventTypeCode: "PURCHASE", fieldPath: "", minSum: 100 },
      };
      expect(errors(expr).length).toBeGreaterThan(0);
    });

    it("flags lastEventTime with empty eventTypeCode", () => {
      const expr: Expression = { lastEventTime: { eventTypeCode: "", maxDaysSinceLast: 30 } };
      expect(errors(expr).length).toBeGreaterThan(0);
    });

    it("passes funnelStage with a stage", () => {
      const expr: Expression = { funnelStage: { stage: "LOYALTY" } };
      expect(errors(expr)).toEqual([]);
    });

    it("flags funnelStage with empty stage", () => {
      const expr: Expression = { funnelStage: { stage: "" } } as unknown as Expression;
      expect(errors(expr).length).toBeGreaterThan(0);
    });
  });
});

describe("validateExpressionTree — placeholder path backstop (Unit 4, R2a)", () => {
  it("passes a fully-specified path (no regression)", () => {
    const expr: Expression = {
      equals: { path: "$.status", value: "y", extractValueFromPath: false, defaultResult: false },
    };
    expect(errors(expr)).toEqual([]);
  });

  it("flags a bare '$.' placeholder path with the existing 'needs a field selected' message", () => {
    const expr: Expression = {
      equals: { path: "$.", value: "y", extractValueFromPath: false, defaultResult: false },
    };
    expect(errors(expr)).toEqual(["path:Equals needs a field selected."]);
  });

  it("flags a bare '$.eventData.' placeholder path", () => {
    const expr: Expression = { exists: { path: "$.eventData." } };
    expect(errors(expr)).toEqual(["path:Exists needs a field selected."]);
  });

  it("flags a bare '$.eventData' placeholder path (no trailing segment either)", () => {
    const expr: Expression = { exists: { path: "$.eventData" } };
    expect(errors(expr).length).toBeGreaterThan(0);
  });

  it("does NOT reject a path whose only segment happens to share a name with an operator (R2b collision is Unit 3's job, not this backstop's)", () => {
    const expr: Expression = { exists: { path: "$.funnelStage" } };
    expect(errors(expr)).toEqual([]);
  });

  it("does NOT reject a path with a real trailing segment that shares a name with an operator", () => {
    const expr: Expression = { exists: { path: "$.eventData.funnelStage" } };
    expect(errors(expr)).toEqual([]);
  });

  it("flags eventSum's placeholder fieldPath the same way", () => {
    const expr: Expression = {
      eventSum: { eventTypeCode: "PURCHASE", fieldPath: "$.", minSum: 100 },
    };
    expect(errors(expr)).toEqual(["fieldPath:Event Sum needs a field selected."]);
  });

  it("flags between's placeholder path", () => {
    const expr: Expression = {
      between: { path: "$.", lowerBound: 0, upperBound: 10, extractValueFromPath: false },
    };
    expect(errors(expr)).toEqual(["path:Between needs a field selected."]);
  });

  it("flags a collection op's placeholder path", () => {
    const expr: Expression = { in: { path: "$.", values: ["a"], extractValues: false } };
    expect(errors(expr)).toEqual(["path:In needs a field selected."]);
  });
});

describe("notification action registration", () => {
  it("lists Send Notification and creates its required draft fields", () => {
    expect(ACTION_CATEGORIES.Notifications).toEqual(["sendNotification"]);
    expect(ACTION_TYPE_NAMES.sendNotification).toBe("Send Notification");
    expect(getActionCategoryColor("sendNotification")).toBe("bg-muted-foreground");
    expect(createDefaultAction("sendNotification")).toEqual({
      sendNotification: { channelCode: "", templateCode: "" },
    });
  });

  it("blocks notifications until both dispatch-time required codes are set", () => {
    expect(
      errors({ true: { actions: [{ sendNotification: { channelCode: "", templateCode: "" } }] } })
    ).toEqual([
      "channelCode:Send Notification needs a channel code.",
      "templateCode:Send Notification needs a template code.",
    ]);
    expect(
      errors({
        true: {
          actions: [{ sendNotification: { channelCode: "EMAIL", templateCode: "WELCOME" } }],
        },
      })
    ).toEqual([]);
  });
});
