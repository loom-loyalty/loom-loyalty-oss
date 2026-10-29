import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ContactAddressFormSheet } from "../contact-address-form-sheet.js";

type Props = Parameters<typeof ContactAddressFormSheet>[0];

function renderSheet(overrides: Partial<Props> = {}) {
  return render(
    <ContactAddressFormSheet
      open
      onOpenChange={vi.fn()}
      mode="create"
      onSubmit={vi.fn().mockResolvedValue(undefined)}
      {...overrides}
    />
  );
}

describe("ContactAddressFormSheet server field errors", () => {
  it("shows a nested path's error under the matching control and clears it on edit", () => {
    renderSheet({
      error: { message: "Some fields are invalid.", requestId: "req-addr-9" },
      fieldErrors: [{ field: "postalCode", message: "Postal code is not valid." }],
    });

    const postal = screen.getByLabelText(/Postal Code/);
    expect(postal).toHaveAttribute("aria-invalid", "true");
    expect(postal).toHaveAccessibleDescription("Postal code is not valid.");
    expect(screen.getByText(/Reference:/)).toHaveTextContent("Reference: req-addr-9");

    fireEvent.change(postal, { target: { value: "94107" } });

    expect(postal).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText("Postal code is not valid.")).not.toBeInTheDocument();
  });

  it("puts an error for a field it does not render in the banner", () => {
    renderSheet({ fieldErrors: [{ field: "status", message: "Status is not allowed." }] });

    expect(screen.getByText("Status is not allowed.").closest('[role="alert"]')).not.toBeNull();
  });
});
