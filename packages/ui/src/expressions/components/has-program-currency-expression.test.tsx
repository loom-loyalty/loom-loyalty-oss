import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { HasProgramCurrencyExpression } from "../types";
import { HasProgramCurrencyExpressionComponent } from "./has-program-currency-expression";

type HasProgramCurrencyData = HasProgramCurrencyExpression["hasProgramCurrency"];

const baseValue: HasProgramCurrencyData = { programCurrencyCode: "POINTS" };

describe("HasProgramCurrencyExpressionComponent round-trip", () => {
  it("emits comparisonAmount (not minimumBalance) and never a program id/code", () => {
    const onChange = vi.fn();
    render(
      <HasProgramCurrencyExpressionComponent value={baseValue} onChange={onChange} mode="edit" />
    );

    // The only numeric input is the comparison amount.
    const amount = screen.getByRole("spinbutton");
    fireEvent.change(amount, { target: { value: "500" } });

    const emitted = onChange.mock.calls[0]![0] as Record<string, unknown>;
    expect(emitted).toMatchObject({ programCurrencyCode: "POINTS", comparisonAmount: 500 });
    // Drifted / server-derived fields must not be emitted by the client.
    expect(emitted).not.toHaveProperty("minimumBalance");
    expect(emitted).not.toHaveProperty("programId");
    expect(emitted).not.toHaveProperty("programCode");
  });

  it("round-trips the currency code", () => {
    const onChange = vi.fn();
    render(
      <HasProgramCurrencyExpressionComponent value={baseValue} onChange={onChange} mode="edit" />
    );

    const currency = screen.getByPlaceholderText("e.g. POINTS, MILES");
    fireEvent.change(currency, { target: { value: "MILES" } });

    expect(onChange.mock.calls[0]![0]).toMatchObject({ programCurrencyCode: "MILES" });
  });

  it("associates accessible labels with the currency and amount inputs (WCAG 2.1 AA)", () => {
    render(
      <HasProgramCurrencyExpressionComponent value={baseValue} onChange={vi.fn()} mode="edit" />
    );

    expect(screen.getByLabelText(/currency code/i)).toHaveValue("POINTS");
    expect(screen.getByLabelText(/comparison amount/i)).toBeInTheDocument();
  });
});
