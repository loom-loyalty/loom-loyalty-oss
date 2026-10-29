import { describe, expect, it } from "vitest";

import { dataModelCodeKey, sameDataModelCode } from "./code-key";

describe("dataModelCodeKey", () => {
  it("folds the two spellings of the same code onto one key", () => {
    // The migration this exists for: CUSTOM_EVENT became custom-event,
    // and the client sees both depending on the build.
    expect(dataModelCodeKey("CUSTOM_EVENT")).toBe(dataModelCodeKey("custom-event"));
    expect(dataModelCodeKey("EVENT")).toBe(dataModelCodeKey("event"));
  });

  it("collapses repeated separators so no spelling slips past", () => {
    expect(dataModelCodeKey("CUSTOM__EVENT")).toBe("custom-event");
    expect(dataModelCodeKey("custom--event")).toBe("custom-event");
    expect(dataModelCodeKey("custom-_event")).toBe("custom-event");
  });

  it("trims and tolerates a missing code", () => {
    expect(dataModelCodeKey("  EVENT  ")).toBe("event");
    expect(dataModelCodeKey(undefined)).toBe("");
    expect(dataModelCodeKey("")).toBe("");
  });

  it("does not conflate genuinely different codes", () => {
    // Folding must not become "everything matches": only case and separator
    // differences are equivalent.
    expect(dataModelCodeKey("CUSTOM_EVENT")).not.toBe(dataModelCodeKey("CUSTOM_EVENT_LINE_ITEM"));
    expect(sameDataModelCode("event", "event-rule")).toBe(false);
  });
});

describe("sameDataModelCode", () => {
  it("matches across the migration's spelling difference", () => {
    expect(sameDataModelCode("CUSTOM_EVENT", "custom-event")).toBe(true);
    expect(sameDataModelCode("custom-event", "CUSTOM_EVENT")).toBe(true);
    expect(sameDataModelCode("METADATA", "metadata")).toBe(true);
  });

  it("treats two absent codes as equal and an absent code as unmatched", () => {
    expect(sameDataModelCode(undefined, undefined)).toBe(true);
    expect(sameDataModelCode(undefined, "event")).toBe(false);
  });
});
