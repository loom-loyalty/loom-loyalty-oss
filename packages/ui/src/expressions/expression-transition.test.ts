import { describe, expect, it } from "vitest";

import {
  isAnniversaryMatch,
  isComparisonFamilyType,
  transitionExpressionData,
  type ComparisonFamilyType,
} from "./expression-transition";

describe("isComparisonFamilyType (fix #12 domain guard)", () => {
  it("accepts the 14 comparison-family types", () => {
    const comparisonTypes: ComparisonFamilyType[] = [
      "equals",
      "notEquals",
      "greaterThan",
      "greaterThanEquals",
      "lessThan",
      "lessThanEquals",
      "between",
      "startsWith",
      "endsWith",
      "matches",
      "in",
      "notIn",
      "containsAny",
      "containsAll",
    ];
    for (const type of comparisonTypes) {
      expect(isComparisonFamilyType(type)).toBe(true);
    }
  });

  it("rejects composites and specialized types", () => {
    for (const type of [
      "and",
      "or",
      "not",
      "true",
      "exists",
      "notExists",
      "empty",
      "notEmpty",
      "hasBadge",
      "currentTier",
      "targetCompleted",
      "hasProgramCurrency",
      "eventCount",
      "eventSum",
      "eventExists",
      "lastEventTime",
      "funnelStage",
    ]) {
      expect(isComparisonFamilyType(type)).toBe(false);
    }
  });
});

describe("transitionExpressionData (KTD10)", () => {
  it("preserves path and the scalar value between single-value operators (greaterThan -> lessThanEquals)", () => {
    const result = transitionExpressionData("greaterThan", "lessThanEquals", {
      path: "$.eventData.order.total",
      value: 100,
      extractValueFromPath: false,
      preOperation: "ABS",
      defaultResult: true,
    });

    expect(result).toEqual({
      path: "$.eventData.order.total",
      value: 100,
      extractValueFromPath: false,
      preOperation: "ABS",
      defaultResult: true,
    });
  });

  it("seeds lowerBound from the scalar value and leaves upperBound empty (equals -> between)", () => {
    const result = transitionExpressionData("equals", "between", {
      path: "$.eventData.order.total",
      value: 100,
      extractValueFromPath: false,
      defaultResult: false,
    });

    expect(result.path).toBe("$.eventData.order.total");
    expect(result.lowerBound).toBe(100);
    expect(result.upperBound).toBeUndefined();
    expect(result).not.toHaveProperty("value");
    expect(result).not.toHaveProperty("defaultResult");
  });

  it("wraps the scalar into a single-element values array with extractValues: false (equals -> in)", () => {
    const result = transitionExpressionData("equals", "in", {
      path: "$.eventData.order.status",
      value: "paid",
      extractValueFromPath: false,
      defaultResult: false,
    });

    expect(result).toEqual({
      path: "$.eventData.order.status",
      values: ["paid"],
      extractValues: false,
      defaultResult: false,
    });
  });

  it("keeps lowerBound as the surviving value and drops upperBound/inclusivity flags (between -> greaterThan)", () => {
    const result = transitionExpressionData("between", "greaterThan", {
      path: "$.eventData.order.total",
      lowerBound: 10,
      upperBound: 100,
      includeLowerBound: true,
      includeUpperBound: false,
      extractValueFromPath: false,
    });

    expect(result).toEqual({
      path: "$.eventData.order.total",
      value: 10,
      extractValueFromPath: false,
    });
    expect(result).not.toHaveProperty("upperBound");
    expect(result).not.toHaveProperty("includeLowerBound");
    expect(result).not.toHaveProperty("includeUpperBound");
  });

  it("unwraps the first values element back to a scalar and drops extras/extractValues/valuesPath (in -> equals)", () => {
    const result = transitionExpressionData("in", "equals", {
      path: "$.eventData.order.status",
      values: ["paid", "shipped", "delivered"],
      extractValues: false,
      valuesPath: "$.eventData.allowedStatuses",
    });

    expect(result).toEqual({
      path: "$.eventData.order.status",
      value: "paid",
      extractValueFromPath: false,
      defaultResult: false,
    });
  });

  it("carries extractValueFromPath's path-string value across single-value switches instead of coercing it", () => {
    const result = transitionExpressionData("equals", "greaterThan", {
      path: "$.eventData.order.total",
      value: "$.eventData.threshold",
      extractValueFromPath: true,
      defaultResult: false,
    });

    expect(result.value).toBe("$.eventData.threshold");
    expect(result.extractValueFromPath).toBe(true);
  });

  it("coerces a non-numeric scalar to 0 when entering a numeric operator without extractValueFromPath", () => {
    const result = transitionExpressionData("startsWith", "greaterThan", {
      path: "$.eventData.order.status",
      value: "paid",
      ignoreCase: false,
      extractValueFromPath: false,
    });

    expect(result.value).toBe(0);
  });

  it("defaults ignoreCase to false when entering a string operator from a non-string source", () => {
    const result = transitionExpressionData("greaterThan", "startsWith", {
      path: "$.eventData.order.total",
      value: 100,
      extractValueFromPath: false,
    });

    expect(result.value).toBe("100");
    expect(result.ignoreCase).toBe(false);
  });

  it("drops preOperation when the target type is a string operator (not numeric/between)", () => {
    const result = transitionExpressionData("greaterThan", "startsWith", {
      path: "$.eventData.order.total",
      value: 100,
      extractValueFromPath: false,
      preOperation: "ABS",
    });

    expect(result).not.toHaveProperty("preOperation");
  });

  it("preserves preOperation when switching into equals (equals declares it, per the birthday-segment-backed schema fix)", () => {
    const result = transitionExpressionData("greaterThan", "equals", {
      path: "$.birthDate",
      value: true,
      extractValueFromPath: false,
      preOperation: { matchesCurrentDate: { timeZone: "ORGANIZATION" } },
    });

    expect(result.preOperation).toEqual({ matchesCurrentDate: { timeZone: "ORGANIZATION" } });
  });

  it("preserves preOperation when switching into notEquals, symmetric with equals (openapi.yaml declares it unconditionally on both)", () => {
    const result = transitionExpressionData("greaterThan", "notEquals", {
      path: "$.birthDate",
      value: true,
      extractValueFromPath: false,
      preOperation: { matchesCurrentDate: { timeZone: "ORGANIZATION" } },
    });

    expect(result.preOperation).toEqual({ matchesCurrentDate: { timeZone: "ORGANIZATION" } });
  });

  it("carries the FULL values array (not just one element) between two collection types (in -> notIn)", () => {
    const result = transitionExpressionData("in", "notIn", {
      path: "$.eventData.order.status",
      values: ["paid", "shipped", "delivered"],
      extractValues: false,
      valuesPath: "$.eventData.allowedStatuses",
    });

    expect(result).toEqual({
      path: "$.eventData.order.status",
      values: ["paid", "shipped", "delivered"],
      extractValues: false,
      valuesPath: "$.eventData.allowedStatuses",
    });
  });

  it("carries the full values array between containsAny -> containsAll, preserving extractValues", () => {
    const result = transitionExpressionData("containsAny", "containsAll", {
      path: "$.eventData.order.tags",
      values: ["a", "b", "c"],
      extractValues: true,
    });

    expect(result).toEqual({
      path: "$.eventData.order.tags",
      values: ["a", "b", "c"],
      extractValues: true,
    });
  });

  it("preserves extractValueFromPath when switching OUT of between into a numeric operator", () => {
    const result = transitionExpressionData("between", "greaterThan", {
      path: "$.eventData.order.total",
      lowerBound: "$.eventData.threshold",
      upperBound: 100,
      extractValueFromPath: true,
    });

    expect(result.value).toBe("$.eventData.threshold");
    expect(result.extractValueFromPath).toBe(true);
  });

  it("preserves extractValueFromPath when switching OUT of between into a string operator", () => {
    const result = transitionExpressionData("between", "startsWith", {
      path: "$.eventData.order.code",
      lowerBound: "$.eventData.prefix",
      upperBound: undefined,
      extractValueFromPath: true,
    });

    expect(result.value).toBe("$.eventData.prefix");
    expect(result.extractValueFromPath).toBe(true);
  });

  it("is a no-op when fromType equals toType", () => {
    const data = { path: "$.eventData.order.total", value: 100, extractValueFromPath: false };
    expect(transitionExpressionData("greaterThan", "greaterThan", data)).toBe(data);
  });
});

describe("isAnniversaryMatch", () => {
  const anniversary = {
    path: "$.birthDate",
    value: true,
    preOperation: { matchesCurrentDate: { timeZone: "ORGANIZATION" } },
  };

  it("matches equals and notEquals with matchesCurrentDate compared to true", () => {
    expect(isAnniversaryMatch("equals", anniversary)).toBe(true);
    expect(isAnniversaryMatch("notEquals", anniversary)).toBe(true);
  });

  it("rejects other operators, a non-true value, and other preOperations", () => {
    expect(isAnniversaryMatch("greaterThan", anniversary)).toBe(false);
    expect(isAnniversaryMatch("equals", { ...anniversary, value: "true" })).toBe(false);
    expect(
      isAnniversaryMatch("equals", { ...anniversary, preOperation: { multiply: { operand: 2 } } })
    ).toBe(false);
    expect(isAnniversaryMatch("equals", { path: "$.birthDate", value: true })).toBe(false);
  });
});
