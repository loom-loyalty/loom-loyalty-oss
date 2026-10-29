import { describe, expect, it } from "vitest";

import { isAiVerificationRequiredEntityType } from "./ai-verification";

describe("isAiVerificationRequiredEntityType", () => {
  it.each(["event-rule", "customer-audience", "EVENT_RULE", "CUSTOMER_AUDIENCE"])(
    "returns true for %s",
    (entityType) => {
      expect(isAiVerificationRequiredEntityType(entityType)).toBe(true);
    }
  );

  it.each([
    "tier",
    "program",
    "badge",
    "offer",
    "target",
    "",
    "Event_Rule",
    "event_rule",
    "eventRule",
  ])("returns false for %s", (entityType) => {
    expect(isAiVerificationRequiredEntityType(entityType)).toBe(false);
  });
});
