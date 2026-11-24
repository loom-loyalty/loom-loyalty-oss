import { describe, expect, it } from "vitest";

import { getEventRuleLifecycleActions, isEventRuleVersionReplaced } from "./event-rule-actions.js";

describe("getEventRuleLifecycleActions (only actions that can succeed)", () => {
  it.each([
    ["DRAFT", { publish: true, pause: false, resume: false }],
    ["PUBLISHED", { publish: false, pause: true, resume: false }],
    ["PAUSED", { publish: false, pause: false, resume: true }],
    ["ARCHIVED", { publish: false, pause: false, resume: false }],
    [undefined, { publish: false, pause: false, resume: false }],
    ["SOMETHING_NEW", { publish: false, pause: false, resume: false }],
  ])("%s offers %o", (status, expected) => {
    expect(getEventRuleLifecycleActions(status)).toEqual(expected);
  });

  it.each(["DRAFT", "PUBLISHED", "PAUSED", "ARCHIVED"])(
    "an old (replaced) %s version offers nothing",
    (status) => {
      expect(getEventRuleLifecycleActions(status, { isReplaced: true })).toEqual({
        publish: false,
        pause: false,
        resume: false,
      });
    }
  );

  it("never offers more than one lifecycle action for any status", () => {
    for (const status of ["DRAFT", "PUBLISHED", "PAUSED", "ARCHIVED", undefined]) {
      const actions = getEventRuleLifecycleActions(status);
      expect(Object.values(actions).filter(Boolean).length).toBeLessThanOrEqual(1);
    }
  });
});

describe("isEventRuleVersionReplaced", () => {
  const v1 = { eventRuleId: "a", version: 1, versionStatus: "PAUSED" };

  it("is true when a newer non-draft version exists", () => {
    expect(
      isEventRuleVersionReplaced(v1, [
        v1,
        { eventRuleId: "b", version: 2, versionStatus: "PUBLISHED" },
      ])
    ).toBe(true);
  });

  it("is false when only a newer draft exists", () => {
    expect(
      isEventRuleVersionReplaced(v1, [v1, { eventRuleId: "b", version: 2, versionStatus: "DRAFT" }])
    ).toBe(false);
  });

  it("is false for the newest version or an unknown version number", () => {
    expect(isEventRuleVersionReplaced({ eventRuleId: "b", version: 2 }, [v1])).toBe(false);
    expect(isEventRuleVersionReplaced({ eventRuleId: "a" }, [v1])).toBe(false);
  });
});
