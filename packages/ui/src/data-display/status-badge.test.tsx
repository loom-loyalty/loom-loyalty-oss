import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "./status-badge";

describe("StatusBadge — 'no effect recorded' variant", () => {
  it("renders the plain-language label", () => {
    render(<StatusBadge status="no effect recorded" />);
    expect(screen.getByText("No effect recorded")).toBeInTheDocument();
  });

  it("uses muted/inactive semantic tokens, not raw colors", () => {
    render(<StatusBadge status="no effect recorded" />);
    const badge = screen.getByRole("status", { name: /No effect recorded/ });
    expect(badge.className).toContain("bg-status-inactive-bg");
    expect(badge.className).toContain("text-status-inactive-fg");
  });

  it("is visually distinct from success/warning/error status tokens", () => {
    const { unmount } = render(<StatusBadge status="no effect recorded" />);
    const noEffectClass = screen.getByRole("status").className;
    unmount();

    render(<StatusBadge status="success" />);
    const successClass = screen.getByRole("status").className;

    expect(noEffectClass).not.toBe(successClass);
    expect(noEffectClass).not.toContain("success");
    expect(noEffectClass).not.toContain("status-error");
    expect(noEffectClass).not.toContain("status-pending");
  });
});
