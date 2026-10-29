import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GreaterThanExpression } from "../types";
import { NumericExpressionComponent } from "./numeric-expression";

describe("NumericExpressionComponent — comparand string arm", () => {
  it("keeps the JsonPath string (never NaN) when extracting the comparand from a path", () => {
    const onChange = vi.fn();
    const value: GreaterThanExpression["greaterThan"] = {
      path: "$.amount",
      value: "",
      extractValueFromPath: true,
    };

    render(<NumericExpressionComponent value={value} onChange={onChange} mode="edit" />);

    // In extract-from-path mode the comparand is a JsonPath text input.
    const input = screen.getByPlaceholderText("$.eventData.comparisonField");
    fireEvent.change(input, { target: { value: "$.eventData.threshold" } });

    const emitted = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as { value: unknown };
    expect(emitted.value).toBe("$.eventData.threshold");
    expect(typeof emitted.value).toBe("string");
    expect(Number.isNaN(emitted.value)).toBe(false);
  });

  it("coerces to a number when the comparand is a literal (not a path)", () => {
    const onChange = vi.fn();
    const value: GreaterThanExpression["greaterThan"] = {
      path: "$.amount",
      value: 0,
      extractValueFromPath: false,
    };

    render(<NumericExpressionComponent value={value} onChange={onChange} mode="edit" />);

    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "42" } });

    const emitted = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as { value: unknown };
    expect(emitted.value).toBe(42);
  });
});
