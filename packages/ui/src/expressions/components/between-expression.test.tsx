import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BetweenExpression } from "../types";
import { BetweenExpressionComponent } from "./between-expression";

type BetweenData = BetweenExpression["between"];

const baseValue: BetweenData = {
  path: "$.eventData.amount",
  lowerBound: 0,
  upperBound: 100,
  extractValueFromPath: false,
};

describe("BetweenExpressionComponent round-trip", () => {
  it("renders the current bounds and emits the corrected lowerBound/upperBound shape", () => {
    const onChange = vi.fn();
    render(<BetweenExpressionComponent value={baseValue} onChange={onChange} mode="edit" />);

    // Two numeric inputs: [0] lower bound, [1] upper bound.
    const inputs = screen.getAllByRole("spinbutton");
    expect(inputs[0]).toHaveValue(0);
    expect(inputs[1]).toHaveValue(100);

    fireEvent.change(inputs[0]!, { target: { value: "5" } });

    const emitted = onChange.mock.calls[0]![0] as Record<string, unknown>;
    expect(emitted).toMatchObject({ lowerBound: 5, upperBound: 100 });
    // The drifted field names must never be emitted.
    expect(emitted).not.toHaveProperty("minValue");
    expect(emitted).not.toHaveProperty("maxValue");
  });

  it("emits upperBound when the upper input changes", () => {
    const onChange = vi.fn();
    render(<BetweenExpressionComponent value={baseValue} onChange={onChange} mode="edit" />);

    const upper = screen.getAllByRole("spinbutton")[1]!;
    fireEvent.change(upper, { target: { value: "250" } });

    expect(onChange.mock.calls[0]![0]).toMatchObject({ upperBound: 250, lowerBound: 0 });
  });

  it("associates an accessible label with each bound input (WCAG 2.1 AA)", () => {
    render(<BetweenExpressionComponent value={baseValue} onChange={vi.fn()} mode="edit" />);

    expect(screen.getByLabelText(/lower bound/i)).toHaveValue(0);
    expect(screen.getByLabelText(/upper bound/i)).toHaveValue(100);
  });
});
