import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ActionTypePicker } from "./action-type-picker";

describe("ActionTypePicker", () => {
  it("finds Send Notification when searching notif", async () => {
    const user = userEvent.setup();
    render(<ActionTypePicker onSelect={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Add action" }));
    await user.type(screen.getByPlaceholderText("Search actions..."), "notif");

    expect(screen.getByText("Send Notification")).toBeInTheDocument();
  });
});
