import { describe, expect, it } from "vitest";

import { nameFrom } from "./action-summary-lookups";

interface Program {
  programId: string;
  code?: string;
  name?: string;
}

describe("nameFrom", () => {
  const items: Program[] = [
    { programId: "p1", code: undefined, name: "Untitled" },
    { programId: "p2", code: "LOYALTY_A", name: "Loyalty A" },
    { programId: "p3", code: "NO_NAME" },
  ];

  it("matches by id", () => {
    expect(nameFrom(items, "p2", undefined, "programId")).toBe("Loyalty A");
  });

  it("matches by code", () => {
    expect(nameFrom(items, undefined, "LOYALTY_A", "programId")).toBe("Loyalty A");
  });

  it("returns undefined when neither id nor code is supplied", () => {
    expect(nameFrom(items, undefined, undefined, "programId")).toBeUndefined();
  });

  it("falls back to the code when a match has no name", () => {
    expect(nameFrom(items, "p3", "NO_NAME", "programId")).toBe("NO_NAME");
  });

  it("returns the code as-is when no item matches", () => {
    expect(nameFrom(items, undefined, "GHOST", "programId")).toBe("GHOST");
  });

  it("does not false-positive match an earlier item with an undefined code when only an id is given (adversarial review finding)", () => {
    // items[0] has code: undefined — a naive `item.code === code` check with
    // code=undefined would match it (undefined === undefined) before ever
    // reaching the item whose id actually matches.
    expect(nameFrom(items, "p2", undefined, "programId")).toBe("Loyalty A");
  });

  it("does not false-positive match an earlier item with an undefined id when only a code is given", () => {
    const itemsWithUndefinedId: Program[] = [
      { programId: undefined as unknown as string, code: undefined, name: "Untitled" },
      { programId: "p2", code: "LOYALTY_A", name: "Loyalty A" },
    ];
    expect(nameFrom(itemsWithUndefinedId, undefined, "LOYALTY_A", "programId")).toBe("Loyalty A");
  });
});
