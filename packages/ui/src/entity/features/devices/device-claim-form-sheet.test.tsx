import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Mock the location field so the form-sheet test is isolated from SDK hooks.
// Two fixed locations back the fake findLocation lookup used to resolve the
// select's id to the code the form submits.
const LOCATIONS_BY_ID: Record<string, { locationId: string; name: string; code: string }> = {
  loc_1: { locationId: "loc_1", name: "Downtown", code: "DOWNTOWN" },
  loc_2: { locationId: "loc_2", name: "Uptown", code: "UPTOWN" },
};

vi.mock("../../../forms/location-field/index.js", () => ({
  // Spreads ...rest onto the underlying element (matching
  // metadata-form-sheet.test.tsx's mock convention) so any prop the real
  // consumer passes -- including aria-required -- reaches the DOM and is
  // assertable, rather than being silently dropped by a hand-picked prop list.
  // renderCreateSheet is pulled out (not spread onto the DOM) and stands in for
  // the real field's "Add New Location" dropdown option.
  LocationField: function MockLocationField({
    value,
    onValueChange,
    renderCreateSheet,
    ...rest
  }: {
    value: string;
    onValueChange: (v: string) => void;
    renderCreateSheet?: (open: boolean, onOpenChange: (open: boolean) => void) => ReactNode;
    [key: string]: unknown;
  }): ReactNode {
    const [createOpen, setCreateOpen] = useState(false);
    return (
      <>
        <select
          {...(rest as Record<string, unknown>)}
          aria-label="Location"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
        >
          <option value="">Select a location...</option>
          <option value="loc_1">Downtown</option>
          <option value="loc_2">Uptown</option>
        </select>
        {renderCreateSheet && (
          <button type="button" onClick={() => setCreateOpen(true)}>
            Add New Location
          </button>
        )}
        {renderCreateSheet?.(createOpen, setCreateOpen)}
      </>
    );
  },
  useLocationField: () => ({
    findLocation: (id: string) => LOCATIONS_BY_ID[id],
  }),
}));

// Stand-in for the metadata create sheet: one button submits a fixed Location
// body, so the test drives the claim sheet's create wiring, not the form.
const NEW_LOCATION_BODY = { typeCode: "STORE", code: "harbor", name: "Harbor" };
vi.mock("../metadata/metadata-form-sheet.js", () => ({
  MetadataFormSheet: ({
    open,
    onSubmit,
    error,
    typeCategory,
    entityLabel,
  }: {
    open: boolean;
    onSubmit: (data: unknown, category: string) => Promise<void>;
    error?: string | null;
    typeCategory?: string;
    entityLabel?: string;
  }): ReactNode =>
    open ? (
      <div data-testid="create-location-sheet" data-type-category={typeCategory}>
        <button type="button" onClick={() => void onSubmit(NEW_LOCATION_BODY, "LOCATION")}>
          Create {entityLabel}
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    ) : null,
}));

import { DeviceClaimFormSheet } from "./device-claim-form-sheet.js";

function renderSheet(overrides: Partial<React.ComponentProps<typeof DeviceClaimFormSheet>> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  const result = render(
    <DeviceClaimFormSheet open onOpenChange={onOpenChange} onSubmit={onSubmit} {...overrides} />
  );
  return { ...result, onSubmit, onOpenChange };
}

describe("[audit] DeviceClaimFormSheet", () => {
  it("disables submit until both location and confirmation code are filled", () => {
    renderSheet();
    const submitButton = screen.getByRole("button", { name: /^Claim$/i });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "loc_1" } });
    expect(submitButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Confirmation Code/i), {
      target: { value: "123456" },
    });
    expect(submitButton).not.toBeDisabled();
  });

  it("forwards aria-required to LocationField (WCAG 4.1.2 — required state announced, not just a visual asterisk)", () => {
    renderSheet();
    expect(screen.getByLabelText("Location").getAttribute("aria-required")).toBe("true");
  });

  it("shows a loading indicator and disables submit while isSubmitting", () => {
    renderSheet({ isSubmitting: true });
    const submitButton = screen.getByRole("button", { name: /^Claim$/i });
    expect(submitButton).toBeDisabled();
    expect(submitButton.querySelector(".animate-spin")).not.toBeNull();
  });

  it("submits { locationCode, confirmationCode } resolved from the selected location", async () => {
    const { onSubmit } = renderSheet();

    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "loc_2" } });
    fireEvent.change(screen.getByLabelText(/Confirmation Code/i), {
      target: { value: "654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Claim$/i }));

    expect(onSubmit).toHaveBeenCalledWith({ locationCode: "UPTOWN", confirmationCode: "654321" });
  });

  it("resets fields when the sheet is cancelled", () => {
    const { onOpenChange } = renderSheet();
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "loc_1" } });
    fireEvent.change(screen.getByLabelText(/Confirmation Code/i), {
      target: { value: "999999" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByLabelText(/Confirmation Code/i)).toHaveValue("");
    expect(screen.getByLabelText("Location")).toHaveValue("");
  });

  it("surfaces the error prop in the FormSheet alert region", () => {
    renderSheet({ error: "This device has already been claimed." });
    const alerts = screen.getAllByRole("alert");
    const errorAlert = alerts.find((a) => a.textContent?.includes("already been claimed"));
    expect(errorAlert).toBeDefined();
  });

  it("offers no Add New Location option without onCreateLocation", () => {
    renderSheet();
    expect(screen.queryByRole("button", { name: "Add New Location" })).toBeNull();
  });

  it("creates a Location from the dropdown, selects it, and claims with its code", async () => {
    const onCreateLocation = vi.fn().mockResolvedValue({ locationId: "loc_new", code: "harbor" });
    const { onSubmit } = renderSheet({ onCreateLocation });

    fireEvent.click(screen.getByRole("button", { name: "Add New Location" }));
    const createSheet = screen.getByTestId("create-location-sheet");
    expect(createSheet.getAttribute("data-type-category")).toBe("LOCATION");

    fireEvent.click(screen.getByRole("button", { name: "Create Location" }));
    await waitFor(() => expect(screen.queryByTestId("create-location-sheet")).toBeNull());
    expect(onCreateLocation).toHaveBeenCalledWith(NEW_LOCATION_BODY);

    // loc_new isn't in the (mocked) loaded list yet, so the code comes from the
    // create result rather than findLocation.
    fireEvent.change(screen.getByLabelText(/Confirmation Code/i), {
      target: { value: "141739" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Claim$/i }));
    expect(onSubmit).toHaveBeenCalledWith({ locationCode: "harbor", confirmationCode: "141739" });
  });

  it("keeps the create sheet open and shows the error when creating fails", async () => {
    const onCreateLocation = vi
      .fn()
      .mockRejectedValue(new Error("You don't have permission to create locations."));
    renderSheet({ onCreateLocation });

    fireEvent.click(screen.getByRole("button", { name: "Add New Location" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Location" }));

    expect(
      await screen.findByText("You don't have permission to create locations.")
    ).toBeInTheDocument();
    expect(screen.getByTestId("create-location-sheet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Claim$/i })).toBeDisabled();
  });
});
