import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CommandPalette, type CommandPaletteResult } from "../command-palette";

// The selected row is bg-primary. Text on it must use primary-foreground, never the default
// foreground (near-black on dark teal) or muted-foreground. jsdom computes no CSS, so this pins
// the selected-state classes; the Storybook screenshot check measures the real contrast.
const result: CommandPaletteResult = {
  displayLabel: "Marisol Vega",
  entityId: "cust_1",
  entityType: "CUSTOMER",
  snippetText: "marisol.vega@example.com · ASC-1001",
  matchRanges: [{ start: 0, end: 7 }],
  score: 1,
  sourceUrl: "/customers/cust_1",
};

describe("CommandPalette — selected row contrast", () => {
  it("switches highlights and the second line to primary-foreground on the selected row", () => {
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        query="customer:Marisol"
        onQueryChange={() => {}}
        results={[result]}
        onSelect={() => {}}
        scopes={[{ key: "CUSTOMER", label: "Customers", prefix: "customer", requiresPrefix: true }]}
        activeScope="CUSTOMER"
        effectiveQueryLength={7}
      />
    );
    const option = screen.getByRole("option", { name: /marisol vega/i });
    const marks = Array.from(option.querySelectorAll("mark"));
    expect(marks).toHaveLength(2);
    for (const mark of marks) {
      expect(mark.className).toContain("group-data-[selected=true]:text-primary-foreground");
    }
    const secondLine = marks[1]!.parentElement!;
    expect(secondLine.className).toContain("group-data-[selected=true]:text-primary-foreground");
  });
});
