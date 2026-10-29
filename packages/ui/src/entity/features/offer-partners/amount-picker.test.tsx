/**
 * AmountPicker: money-losing amounts can't be picked, and an empty choice is
 * announced and linked to the group.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AmountPicker } from "./amount-picker.js";

const ITEM = {
  name: "Harbor Coffee",
  fixedDenominations: [5, 10, 25],
  offerableDenominations: [10, 25],
};

describe("AmountPicker", () => {
  it("disables amounts that cost more than they earn", () => {
    render(<AmountPicker item={ITEM} value={[10]} onValueChange={vi.fn()} label="Harbor" />);
    expect(screen.getByRole("checkbox", { name: "$5, loses money" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "$25" })).toBeEnabled();
    expect(screen.getByText(/Greyed-out amounts cost more than they earn/)).toBeInTheDocument();
  });

  it("announces an empty choice and links it to the group", () => {
    render(<AmountPicker item={ITEM} value={[]} onValueChange={vi.fn()} label="Harbor" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Pick at least one amount.");
    expect(screen.getByRole("group")).toHaveAttribute("aria-describedby", alert.id);
  });
});
