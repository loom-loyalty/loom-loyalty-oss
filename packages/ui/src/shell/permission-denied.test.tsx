import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PermissionDenied } from "./permission-denied";

describe("PermissionDenied", () => {
  it("preserves the default restricted-access card when no action is supplied", () => {
    render(<PermissionDenied contactAdmin />);

    expect(screen.getByText("Permission Denied")).toBeInTheDocument();
    expect(
      screen.getByText("You don't have permission to access this resource.")
    ).toBeInTheDocument();
    expect(screen.getByText("Please contact your administrator for access.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders an action after the description without changing the existing ARIA structure", async () => {
    const user = userEvent.setup();

    render(
      <PermissionDenied
        description="Enable the premium feature for this organization."
        action={<button type="button">Enable for $X/mo</button>}
      />
    );

    const description = screen.getByText("Enable the premium feature for this organization.");
    const action = screen.getByRole("button", { name: "Enable for $X/mo" });

    expect(
      description.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.getByText("Permission Denied")).toBeInTheDocument();
    expect(document.querySelector('[aria-hidden="true"]')).toBeInTheDocument();

    await user.tab();
    expect(action).toHaveFocus();
  });
});
