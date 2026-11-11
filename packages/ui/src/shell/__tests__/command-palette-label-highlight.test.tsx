import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  CommandPalette,
  type CommandPaletteResult,
  type CommandPaletteScope,
} from "../command-palette";

const scopes: CommandPaletteScope[] = [
  { key: "CUSTOMER", label: "Customers", prefix: "customer", requiresPrefix: true },
];

function customer(overrides: Partial<CommandPaletteResult> = {}): CommandPaletteResult {
  return {
    displayLabel: "Marisol Vega",
    entityId: "cust_1",
    entityType: "CUSTOMER",
    snippetText: "marisol.vega@example.com · ASC-1001",
    matchRanges: [],
    score: 1,
    sourceUrl: "/customers/cust_1",
    ...overrides,
  };
}

function renderWith(query: string, result: CommandPaletteResult, name: RegExp = /marisol vega/i) {
  render(
    <CommandPalette
      open
      onOpenChange={() => {}}
      query={query}
      onQueryChange={() => {}}
      results={[result]}
      onSelect={() => {}}
      scopes={scopes}
      activeScope="CUSTOMER"
      effectiveQueryLength={query.replace(/^customer:/, "").length}
    />
  );
  const option = screen.getByRole("option", { name });
  return Array.from(option.querySelectorAll("mark")).map((m) => m.textContent);
}

describe("CommandPalette — name highlight (brief C follow-up)", () => {
  it("highlights the matched part of the name when the second line is not the name", () => {
    expect(renderWith("customer:Vega", customer())).toEqual(["Vega"]);
  });

  it("matches each word case-insensitively and ignores one-letter words", () => {
    expect(renderWith("customer:marisol v", customer())).toEqual(["Marisol"]);
  });

  it("highlights the name and the second line together", () => {
    const marks = renderWith("customer:Marisol", customer({ matchRanges: [{ start: 0, end: 7 }] }));
    expect(marks).toEqual(["Marisol", "marisol"]);
  });

  it("does not highlight the name twice when the second line is the name", () => {
    const marks = renderWith(
      "customer:Vega",
      customer({ snippetText: "Marisol Vega", matchRanges: [{ start: 8, end: 12 }] })
    );
    expect(marks).toEqual(["Vega"]);
  });

  it("leaves the name plain when nothing in it matches", () => {
    expect(renderWith("customer:ASC-1001", customer())).toEqual([]);
  });
  it("keeps offsets right when lower-casing changes a character's length", () => {
    // "İ".toLowerCase() is two UTF-16 units, so offsets from the folded string would drift.
    const marks = renderWith(
      "customer:pek",
      customer({ displayLabel: "İpek Yılmaz", entityId: "cust_9" }),
      /yılmaz/i
    );
    expect(marks).toEqual(["pek"]);
  });
  it("matches a final sigma whichever way the query or the name spells it", () => {
    const nikos = customer({ displayLabel: "ΝΙΚΟΣ Papas", entityId: "cust_10" });
    expect(renderWith("customer:ΝΙΚΟΣ", nikos, /papas/i)).toEqual(["ΝΙΚΟΣ"]);
  });

  it("matches a typed final sigma against an upper-case name", () => {
    const nikos = customer({ displayLabel: "ΝΙΚΟΣ Papas", entityId: "cust_11" });
    expect(renderWith("customer:νικος", nikos, /papas/i)).toEqual(["ΝΙΚΟΣ"]);
  });
  it("matches a dotted capital I with a plain ASCII query", () => {
    const ipek = customer({ displayLabel: "İpek Yılmaz", entityId: "cust_12" });
    expect(renderWith("customer:ipek", ipek, /yılmaz/i)).toEqual(["İpek"]);
  });
  it("ignores accents, and keeps a decomposed accent inside the highlight", () => {
    const jose = customer({ displayLabel: "Jose\u0301 Ruiz", entityId: "cust_13" });
    expect(renderWith("customer:jose", jose, /ruiz/i)).toEqual(["Jose\u0301"]);
  });
  it("highlights overlapping occurrences of a word", () => {
    const banana = customer({ displayLabel: "Banana Bay", entityId: "cust_14" });
    expect(renderWith("customer:ana", banana, /bay/i).join("")).toBe("anana");
  });
  it("skips a one-character word even when folding expands it", () => {
    // "가" decomposes to two jamo, but it is still a one-character word, which the API skips.
    const kim = customer({ displayLabel: "가람 Kim", entityId: "cust_15" });
    expect(renderWith("customer:가 kim", kim, /kim/i)).toEqual(["Kim"]);
  });
});
