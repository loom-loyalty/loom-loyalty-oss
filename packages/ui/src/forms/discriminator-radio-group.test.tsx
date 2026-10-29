import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DiscriminatorRadioGroup } from "./discriminator-radio-group";
import { FieldErrorsProvider, WithFieldError } from "./field-errors";

const options = [
  { value: "POINTS", label: "Points" },
  { value: "VISITS", label: "Visits" },
];

describe("DiscriminatorRadioGroup", () => {
  it("ties a server field error to the group and makes it focusable", () => {
    render(
      <FieldErrorsProvider
        errors={[{ field: "type", message: "Pick a supported type." }]}
        dismissed={new Set()}
        onDismiss={vi.fn()}
        onRegisteredChange={vi.fn()}
      >
        <WithFieldError field="type" value="POINTS">
          {(fe) => (
            <DiscriminatorRadioGroup
              id="type"
              aria-labelledby="type-label"
              value="POINTS"
              onValueChange={vi.fn()}
              options={options}
              {...fe.inputProps}
            />
          )}
        </WithFieldError>
      </FieldErrorsProvider>
    );

    const group = screen.getByRole("radiogroup");
    const message = screen.getByText("Pick a supported type.");
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAttribute("aria-describedby", message.id);
    expect(group).toHaveAttribute("data-field", "type");
    expect(group).toHaveAttribute("tabindex", "-1");
  });

  it("is not invalid or focusable without an error", () => {
    render(
      <DiscriminatorRadioGroup id="type" value="POINTS" onValueChange={vi.fn()} options={options} />
    );
    const group = screen.getByRole("radiogroup");
    expect(group).not.toHaveAttribute("aria-invalid");
    expect(group).not.toHaveAttribute("tabindex", "-1");
  });
});
