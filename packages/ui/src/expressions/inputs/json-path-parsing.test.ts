import { describe, expect, it } from "vitest";

import { isPrimitiveTypeCode, splitArraySuffix } from "./json-path-parsing.js";

describe("isPrimitiveTypeCode", () => {
  it("matches the pre-migration UPPER_SNAKE spelling", () => {
    expect(isPrimitiveTypeCode("STRING")).toBe(true);
    expect(isPrimitiveTypeCode("DATE_TIME")).toBe(true);
  });

  it("matches the post-migration lowercase-hyphenated spelling for multi-segment primitives", () => {
    // DATE_TIME, LOCAL_DATE_TIME, DATE_TIME_LOCAL, and ENTITY_ID are part of
    // DataModelType's resource-code migration. A bare .toUpperCase() check
    // turns "date-time" into "DATE-TIME" (hyphen, not underscore), which
    // matches neither spelling — this asserts the folded comparison does.
    expect(isPrimitiveTypeCode("date-time")).toBe(true);
    expect(isPrimitiveTypeCode("local-date-time")).toBe(true);
    expect(isPrimitiveTypeCode("date-time-local")).toBe(true);
    expect(isPrimitiveTypeCode("entity-id")).toBe(true);
  });

  it("returns false for a non-primitive (system/custom) DataModelType code", () => {
    expect(isPrimitiveTypeCode("custom-event")).toBe(false);
    expect(isPrimitiveTypeCode("CUSTOM_EVENT")).toBe(false);
  });
});

describe("splitArraySuffix", () => {
  it("splits a trailing array-index suffix off a path segment", () => {
    expect(splitArraySuffix("items[*]")).toEqual({ attribute: "items", isArray: true });
    expect(splitArraySuffix("items[0]")).toEqual({ attribute: "items", isArray: true });
  });

  it("leaves a plain segment untouched", () => {
    expect(splitArraySuffix("items")).toEqual({ attribute: "items", isArray: false });
  });
});
