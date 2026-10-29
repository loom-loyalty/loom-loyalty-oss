import type { DataModelType } from "@loom-loyalty/sdk";
import { describe, expect, it } from "vitest";

import { filterTypesInFamily } from "./type-family";

function type(code: string, overrides: Partial<Omit<DataModelType, "code">> = {}): DataModelType {
  return { code, name: code, dataModelTypeId: `dmt_${code}`, ...overrides };
}

const EVENT = type("EVENT", { system: true });
const CUSTOMEVENT = type("CUSTOMEVENT", { system: true, parentTypeReference: "EVENT" });
const TRANSACTION = type("TRANSACTION", { system: true, parentTypeReference: "EVENT" });
// The real-world case the single-level filter dropped: a published custom
// schema two hops below EVENT.
const CUSTOM_PURCHASE = type("COFFEELOYALTY_PURCHASE", {
  name: "Purchase Event Schema",
  parentTypeReference: "CUSTOMEVENT",
});

describe("filterTypesInFamily", () => {
  it("includes the root itself and its direct children", () => {
    const { types } = filterTypesInFamily([EVENT, CUSTOMEVENT, TRANSACTION], "EVENT");

    expect(types.map((t) => t.code)).toEqual(["EVENT", "CUSTOMEVENT", "TRANSACTION"]);
  });

  it("includes a grandchild reached through an intermediate ancestor", () => {
    const { types } = filterTypesInFamily([EVENT, CUSTOMEVENT, CUSTOM_PURCHASE], "EVENT");

    expect(types.map((t) => t.code)).toContain("COFFEELOYALTY_PURCHASE");
  });

  it("includes a great-grandchild (chain depth is unbounded)", () => {
    const deep = type("DEEP", { parentTypeReference: "COFFEELOYALTY_PURCHASE" });
    const { types } = filterTypesInFamily([EVENT, CUSTOMEVENT, CUSTOM_PURCHASE, deep], "EVENT");

    expect(types.map((t) => t.code)).toContain("DEEP");
  });

  it("excludes types from an unrelated family", () => {
    const customer = type("CUSTOMER", { system: true });
    const loyaltyAccount = type("LOYALTYACCOUNT", {
      system: true,
      parentTypeReference: "CUSTOMER",
    });
    const { types } = filterTypesInFamily(
      [EVENT, CUSTOMEVENT, CUSTOM_PURCHASE, customer, loyaltyAccount],
      "EVENT"
    );

    expect(types.map((t) => t.code)).not.toContain("CUSTOMER");
    expect(types.map((t) => t.code)).not.toContain("LOYALTYACCOUNT");
  });

  it("excludes primitives even when they claim the root as a parent", () => {
    const primitive = type("STRING", { primitive: true, parentTypeReference: "EVENT" });
    const { types } = filterTypesInFamily([EVENT, primitive], "EVENT");

    expect(types.map((t) => t.code)).toEqual(["EVENT"]);
  });

  it("reports a parentTypeReference that resolves to no known type", () => {
    const orphan = type("ORPHAN", { parentTypeReference: "MISSING_ANCESTOR" });
    const { types, unresolvedParentRefs } = filterTypesInFamily([EVENT, orphan], "EVENT");

    expect(types.map((t) => t.code)).toEqual(["EVENT"]);
    expect(unresolvedParentRefs).toEqual(["MISSING_ANCESTOR"]);
  });

  it("terminates on a cyclic parent chain", () => {
    const a = type("A", { parentTypeReference: "B" });
    const b = type("B", { parentTypeReference: "A" });
    const selfRef = type("SELF", { parentTypeReference: "SELF" });

    const { types } = filterTypesInFamily([EVENT, a, b, selfRef], "EVENT");

    expect(types.map((t) => t.code)).toEqual(["EVENT"]);
  });

  it("matches a migrated (kebab) code against the UPPER_SNAKE root literal", () => {
    // `EVENT_FAMILY_ROOT_CODE` is a client-side literal, so it cannot track the
    // platform's rename. Pinning it to one spelling is what got #755 reverted:
    // the family filter would return nothing, `extendsOptions` would be empty,
    // and the builder's "parent required" guard would block every submit.
    const event = type("event", { system: true });
    const customEvent = type("custom-event", { system: true, parentTypeReference: "event" });

    const { types } = filterTypesInFamily([event, customEvent], "EVENT");

    expect(types.map((t) => t.code)).toEqual(["event", "custom-event"]);
  });

  it("matches an UPPER_SNAKE code against a kebab root literal", () => {
    // The same tolerance in the other direction, so the literal can be updated
    // without breaking against a platform that has not migrated yet.
    const { types } = filterTypesInFamily([EVENT, CUSTOMEVENT], "event");

    expect(types.map((t) => t.code)).toEqual(["EVENT", "CUSTOMEVENT"]);
  });

  it("resolves a parentTypeReference recorded before its parent was renamed", () => {
    // The genuinely mixed state during migration: a tenant's custom type still
    // stores `CUSTOM_EVENT` while the system type it names is now `custom-event`.
    // Both values are API-sourced and they disagree with each other.
    const event = type("event", { system: true });
    const customEvent = type("custom-event", { system: true, parentTypeReference: "event" });
    const stale = type("coffeeloyalty-purchase", { parentTypeReference: "CUSTOM_EVENT" });

    const { types, unresolvedParentRefs } = filterTypesInFamily(
      [event, customEvent, stale],
      "event"
    );

    expect(types.map((t) => t.code)).toContain("coffeeloyalty-purchase");
    expect(unresolvedParentRefs).toEqual([]);
  });

  it("returns nothing when the root code itself is absent", () => {
    const { types } = filterTypesInFamily([CUSTOMEVENT, CUSTOM_PURCHASE], "EVENT");

    expect(types).toEqual([]);
  });
});
