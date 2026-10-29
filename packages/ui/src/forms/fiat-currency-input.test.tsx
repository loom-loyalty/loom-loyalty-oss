import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./metadata-field/index.js", () => ({
  MetadataField: ({
    id,
    typeCode,
    value,
    onValueChange,
    disabled,
  }: {
    id?: string;
    typeCode: string;
    value: string;
    onValueChange: (value: string, isSuggested: boolean) => void;
    disabled?: boolean;
  }) => (
    <select
      id={id}
      aria-label="Currency"
      data-metadata-type={typeCode}
      value={value}
      onChange={(event) => onValueChange(event.target.value, false)}
      disabled={disabled}
    >
      <option value="">Select a currency</option>
      <option value="USD">USD</option>
    </select>
  ),
}));

import type { FiatCurrencyValue } from "./fiat-currency-input.js";
import { FiatCurrencyInput } from "./fiat-currency-input.js";

describe("FiatCurrencyInput", () => {
  it("merges amount and currency-code edits into a FiatCurrency value", () => {
    const onChange = vi.fn();
    const { rerender } = render(<FiatCurrencyInput onChange={onChange} showCard={false} />);

    expect(screen.queryByText("*")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Amount/), { target: { value: "12.5" } });
    expect(onChange).toHaveBeenCalledWith({ amount: 12.5 });

    rerender(<FiatCurrencyInput value={{ amount: 12.5 }} onChange={onChange} showCard={false} />);
    fireEvent.change(screen.getByLabelText("Currency"), { target: { value: "USD" } });

    expect(onChange).toHaveBeenLastCalledWith({ amount: 12.5, currencyTypeCode: "USD" });
    expect(screen.getByLabelText("Currency")).toHaveAttribute(
      "data-metadata-type",
      "FIAT_CURRENCY_TYPE"
    );
  });

  it("keeps a decimal amount while it is typed one character at a time", () => {
    const onChange = vi.fn();

    function ControlledFiatCurrencyInput() {
      const [value, setValue] = useState<FiatCurrencyValue>({ currencyTypeCode: "USD" });
      return (
        <FiatCurrencyInput
          value={value}
          onChange={(next) => {
            onChange(next);
            setValue(next ?? {});
          }}
          showCard={false}
        />
      );
    }

    render(<ControlledFiatCurrencyInput />);
    const amount = screen.getByLabelText(/^Amount/) as HTMLInputElement;

    for (const entry of ["1", "12", "12.", "12.5", "12.50"]) {
      fireEvent.change(amount, { target: { value: entry } });
      expect(amount.value).toBe(entry);
    }

    expect(onChange).not.toHaveBeenCalledWith(undefined);
    expect(onChange).toHaveBeenLastCalledWith({ amount: 12.5, currencyTypeCode: "USD" });
  });

  it("uses caller-provided ids and form accessibility props for both controls", () => {
    render(
      <FiatCurrencyInput
        id="activity-detail-eligible-amount"
        aria-invalid
        aria-describedby="eligible-amount-error"
        className="min-h-11"
        required
        showCard={false}
      />
    );

    const amount = screen.getByLabelText(/^Amount/);
    const currency = screen.getByLabelText("Currency");

    expect(amount).toHaveAttribute("id", "activity-detail-eligible-amount-amount");
    expect(currency).toHaveAttribute("id", "activity-detail-eligible-amount-currency");
    expect(amount).toHaveAttribute("aria-invalid", "true");
    expect(amount).toHaveAttribute("aria-describedby", "eligible-amount-error");
    expect(amount.className).toContain("min-h-11");
    expect(screen.getAllByText("*")).toHaveLength(2);
  });
});
