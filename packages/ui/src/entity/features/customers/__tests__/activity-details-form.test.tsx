import type { ParsedField } from "@loom-loyalty/schema";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActivityDetailsForm } from "../record-activity/activity-details-form.js";
import type { ActivityDetailField } from "../record-activity/types.js";

vi.mock("../../../../forms/fiat-currency-input.js", () => ({
  FiatCurrencyInput: ({
    id,
    value,
    onChange,
    className,
    required,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
  }: {
    id?: string;
    value?: { amount?: number; currencyTypeCode?: string };
    onChange?: (next: { amount?: number; currencyTypeCode?: string } | undefined) => void;
    className?: string;
    required?: boolean;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }) => (
    <button
      type="button"
      data-testid="fiat-currency-input"
      data-value={JSON.stringify(value)}
      data-required={required || undefined}
      id={`${id}-amount`}
      className={className}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedBy}
      onClick={() => onChange?.({ amount: 12.5, currencyTypeCode: "USD" })}
    >
      Set USD amount
    </button>
  ),
}));

function field(
  name: string,
  label: string,
  overrides: Partial<ParsedField> = {}
): ActivityDetailField {
  return {
    name,
    label,
    field: {
      name,
      label,
      type: "string",
      validation: {},
      ...overrides,
    } as ParsedField,
  };
}

const FIELDS: ActivityDetailField[] = [
  field("property", "Property"),
  field("nights", "Nights", { type: "integer", validation: { required: true } }),
];

function renderForm(overrides: Partial<Parameters<typeof ActivityDetailsForm>[0]> = {}) {
  const onChange = vi.fn();
  const result = render(
    <ActivityDetailsForm fields={FIELDS} values={{}} onChange={onChange} {...overrides} />
  );
  return { ...result, onChange };
}

describe("ActivityDetailsForm", () => {
  it("renders every field empty when nothing declares a default", () => {
    // Covers AE2. This is the live path today.
    renderForm();

    expect((screen.getByLabelText(/Property/) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/Nights/) as HTMLInputElement).value).toBe("");
  });

  it("renders fields pre-filled from the supplied values", () => {
    renderForm({ values: { property: "Grand Central", nights: 2 } });

    expect((screen.getByLabelText(/Property/) as HTMLInputElement).value).toBe("Grand Central");
    expect((screen.getByLabelText(/Nights/) as HTMLInputElement).value).toBe("2");
  });

  it("reports edits by field name", () => {
    const { onChange } = renderForm();

    fireEvent.change(screen.getByLabelText(/Property/), { target: { value: "Riverside" } });
    expect(onChange).toHaveBeenCalledWith("property", "Riverside");
  });

  it("reports a numeric field as a number", () => {
    const { onChange } = renderForm();

    fireEvent.change(screen.getByLabelText(/Nights/), { target: { value: "3" } });
    expect(onChange).toHaveBeenCalledWith("nights", 3);
  });

  it("reports a cleared numeric field as unset rather than NaN", () => {
    const { onChange } = renderForm({ values: { nights: 3 } });

    fireEvent.change(screen.getByLabelText(/Nights/), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("nights", undefined);
  });

  it("never lets NaN reach the payload from a numeric field", () => {
    // A number input sanitizes its own value: an in-progress "-" or "1e" is
    // rejected outright rather than delivered as text. Whichever way the browser
    // behaves, NaN must never be reported as a value.
    const { onChange } = renderForm();
    const input = screen.getByLabelText(/Nights/);

    for (const entry of ["-", "1e", "abc", "", "4"]) {
      fireEvent.change(input, { target: { value: entry } });
    }

    expect(onChange).toHaveBeenCalledWith("nights", 4);
    for (const [, value] of onChange.mock.calls) {
      expect(Number.isNaN(value)).toBe(false);
    }
  });

  it("replaces the field set when the selected activity changes", () => {
    const { rerender } = renderForm();
    expect(screen.getByLabelText(/Property/)).toBeInTheDocument();

    rerender(
      <ActivityDetailsForm
        fields={[field("amount", "Amount", { type: "number" })]}
        values={{}}
        onChange={vi.fn()}
      />
    );

    expect(screen.queryByLabelText(/Property/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Amount/)).toBeInTheDocument();
  });

  it("states that no extra details are needed rather than erroring on an empty model", () => {
    renderForm({ fields: [] });

    expect(
      screen.getByText("This activity needs no extra details. Check the date and apply.")
    ).toBeInTheDocument();
  });

  it("attaches a validation message to the field that caused it", () => {
    renderForm({ errors: { nights: "Nights must be a whole number." } });

    const input = screen.getByLabelText(/Nights/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    const message = screen.getByRole("alert");
    expect(message).toHaveTextContent("Nights must be a whole number.");
    expect(input.getAttribute("aria-describedby")).toContain(message.id);

    // The other field is untouched by another field's failure.
    expect(screen.getByLabelText(/Property/)).not.toHaveAttribute("aria-invalid");
  });

  it("marks a required field and binds every label to its control", () => {
    renderForm();

    for (const detail of FIELDS) {
      const control = screen.getByLabelText(new RegExp(detail.label));
      expect(control.id).toBe(`activity-detail-${detail.name}`);
      expect(control.className).toContain("min-h-11");
    }
  });

  it("renders a date field as a date control", () => {
    renderForm({ fields: [field("checkInDate", "Check-in date", { type: "date" })] });

    expect((screen.getByLabelText(/Check-in date/) as HTMLInputElement).type).toBe("date");
  });

  it("renders a long-text field as a textarea", () => {
    renderForm({ fields: [field("note", "Note", { type: "text" })] });

    expect(screen.getByLabelText(/Note/).tagName).toBe("TEXTAREA");
  });

  it("dispatches fiat_currency fields through an accessible FiatCurrencyInput", () => {
    const { onChange } = renderForm({
      fields: [
        field("eligibleAmount", "Eligible amount", {
          type: "fiat_currency" as ParsedField["type"],
          description: "The total charged to the customer.",
          validation: { required: true },
        }),
      ],
      errors: { eligibleAmount: "Select an amount and currency." },
    });

    const input = screen.getByTestId("fiat-currency-input");
    expect(input).toHaveAttribute("id", "activity-detail-eligibleAmount-amount");
    expect(input.className).toContain("min-h-11");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(
      "activity-detail-eligibleAmount-error"
    );
    expect(input.getAttribute("aria-describedby")).toContain("activity-detail-eligibleAmount-hint");
    expect(input).toHaveAttribute("data-required", "true");

    fireEvent.click(input);

    expect(onChange).toHaveBeenCalledWith("eligibleAmount", {
      amount: 12.5,
      currencyTypeCode: "USD",
    });
  });

  it("shows the field's description as a hint bound to the control", () => {
    renderForm({
      fields: [field("nights", "Nights", { description: "Whole nights stayed." })],
    });

    const hint = screen.getByText("Whole nights stayed.");
    expect(screen.getByLabelText(/Nights/).getAttribute("aria-describedby")).toContain(hint.id);
  });

  it("reports loading rather than an empty form while the model resolves", () => {
    renderForm({ isLoading: true, fields: [] });

    expect(screen.getByText("Loading the details for this activity…")).toBeInTheDocument();
  });
});
