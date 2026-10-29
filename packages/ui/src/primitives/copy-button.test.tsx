/**
 * CopyButton Component Tests
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "./copy-button.js";

describe("CopyButton", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  it("copies the value and announces success politely", async () => {
    render(<CopyButton value="whsec_abc123" label="Copy signing secret" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy signing secret" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("whsec_abc123");
    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("Copied to clipboard");
  });

  it("surfaces a manual-copy hint when the clipboard write fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });

    render(<CopyButton value="x" label="Copy value" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy value" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/copy manually/i));
  });
});
