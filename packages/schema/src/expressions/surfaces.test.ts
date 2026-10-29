import { describe, expect, it } from "vitest";

import {
  ALL_OPERATORS,
  AUDIENCE_ONLY_OPERATORS,
  CUSTOMER_OPERATORS,
  EVENT_ONLY_OPERATORS,
  EVENT_OPERATORS,
  FEED_OPERATORS,
  REMOVED_OPERATORS,
  isOperatorAllowed,
  operatorsForSurface,
} from "./surfaces.js";

describe("expression surface vocabularies", () => {
  it("enumerates the full 34-operator corrected set", () => {
    expect(ALL_OPERATORS).toHaveLength(34);
    // No duplicates.
    expect(new Set(ALL_OPERATORS).size).toBe(ALL_OPERATORS.length);
  });

  it("gates the five event-window operators out of the event surface", () => {
    expect(AUDIENCE_ONLY_OPERATORS).toEqual([
      "eventCount",
      "eventSum",
      "eventExists",
      "lastEventTime",
      "funnelStage",
    ]);
    for (const op of AUDIENCE_ONLY_OPERATORS) {
      expect(EVENT_OPERATORS).not.toContain(op);
      expect(CUSTOMER_OPERATORS).toContain(op);
    }
  });

  it("shares every operator except the surface-only ones", () => {
    expect(CUSTOMER_OPERATORS).toHaveLength(31);
    expect(EVENT_OPERATORS).toHaveLength(29);
    for (const op of EVENT_OPERATORS) {
      if (EVENT_ONLY_OPERATORS.includes(op)) continue;
      expect(CUSTOMER_OPERATORS).toContain(op);
    }
  });

  it("offers the metadata-hierarchy operators on the event surface only (backend surfaces = EVENT)", () => {
    expect(EVENT_ONLY_OPERATORS).toEqual(["isMetadataType", "inMetadataGroup", "isChildMetadata"]);
    for (const op of EVENT_ONLY_OPERATORS) {
      expect(isOperatorAllowed("event", op)).toBe(true);
      expect(isOperatorAllowed("customer", op)).toBe(false);
    }
  });

  it("resolves the allowlist per surface", () => {
    expect(operatorsForSurface("event")).toBe(EVENT_OPERATORS);
    expect(operatorsForSurface("customer")).toBe(CUSTOMER_OPERATORS);
    expect(operatorsForSurface("feed")).toBe(FEED_OPERATORS);
  });

  it("keeps feed conditions to in-row operators", () => {
    for (const op of [...AUDIENCE_ONLY_OPERATORS, ...EVENT_ONLY_OPERATORS]) {
      expect(isOperatorAllowed("feed", op)).toBe(false);
    }
    for (const op of [
      "hasBadge",
      "currentTier",
      "targetCompleted",
      "hasProgramCurrency",
      "matches",
    ]) {
      expect(isOperatorAllowed("feed", op)).toBe(false);
    }
    expect(isOperatorAllowed("feed", "equals")).toBe(true);
    expect(FEED_OPERATORS).toHaveLength(21);
  });

  it("permits shared operators everywhere but blocks audience-only ops on events", () => {
    expect(isOperatorAllowed("event", "between")).toBe(true);
    expect(isOperatorAllowed("customer", "between")).toBe(true);
    expect(isOperatorAllowed("event", "funnelStage")).toBe(false);
    expect(isOperatorAllowed("customer", "funnelStage")).toBe(true);
    // Unknown operator names are never allowed.
    expect(isOperatorAllowed("event", "isParentMetadata")).toBe(false);
    expect(isOperatorAllowed("customer", "nonsense")).toBe(false);
  });

  it("does not list any removed operator in the DSL", () => {
    for (const removed of REMOVED_OPERATORS) {
      expect(ALL_OPERATORS).not.toContain(removed);
    }
  });
});
