import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReadinessChecklist } from "./readiness-checklist";

describe("ReadinessChecklist", () => {
  const items = [
    { id: "a", label: "Agreements accepted", met: true, description: "Done." },
    {
      id: "b",
      label: "Payment in place",
      met: false,
      description: "Add a card.",
      action: <button type="button">Choose a plan</button>,
    },
  ];

  it("renders a named list with one item per condition", () => {
    render(<ReadinessChecklist label="Go-live checklist" items={items} />);
    const list = screen.getByRole("list", { name: "Go-live checklist" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });

  it("tells screen readers whether each condition is done", () => {
    render(<ReadinessChecklist label="Go-live checklist" items={items} />);
    expect(screen.getByText(", done")).toHaveClass("sr-only");
    expect(screen.getByText(", not done")).toHaveClass("sr-only");
  });

  it("shows an action only for unmet conditions", () => {
    render(
      <ReadinessChecklist
        label="Go-live checklist"
        items={[{ ...items[0]!, action: <button type="button">Hidden</button> }, items[1]!]}
      />
    );
    expect(screen.queryByRole("button", { name: "Hidden" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose a plan" })).toBeInTheDocument();
  });
});
