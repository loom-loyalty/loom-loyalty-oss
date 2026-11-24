import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { EntityRecord } from "../../entity-list.js";
import { getEventRuleColumnsExtended } from "./event-rule-columns.js";

function renderNameCell(rule: EntityRecord) {
  const column = getEventRuleColumnsExtended().find((c) => c.key === "name");
  render(<>{column?.render(rule)}</>);
}

describe("event rule list: Draft open marker", () => {
  it("D1: a live rule with an open draft shows the draft's version", () => {
    renderNameCell({
      name: "Free Wash",
      code: "free-wash",
      versionStatus: "PUBLISHED",
      openDraftVersion: 2,
    });
    expect(screen.getByText("Draft open · v2")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Draft version 2 open")).toHaveClass("sr-only");
  });

  it("D3: a draft row (or a row with no open draft) shows no marker", () => {
    renderNameCell({ name: "New", code: "new", versionStatus: "DRAFT", openDraftVersion: null });
    expect(screen.queryByText(/Draft open/)).toBeNull();
  });

  it("a draft row never shows a marker, even if a number comes back", () => {
    renderNameCell({ name: "D", code: "d", versionStatus: "DRAFT", openDraftVersion: 2 });
    expect(screen.queryByText(/Draft open/)).toBeNull();
  });

  it("D6: a response without the field (older API) shows no marker", () => {
    renderNameCell({ name: "Old", code: "old", versionStatus: "PUBLISHED" });
    expect(screen.queryByText(/Draft open/)).toBeNull();
  });
});
