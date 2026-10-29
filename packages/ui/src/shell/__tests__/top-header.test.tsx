import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TopHeader } from "../top-header";

const user = {
  name: "Test User",
  email: "test@example.com",
  initials: "TU",
};

describe("[WV017] TopHeader icon-only buttons have hover/focus tooltips", () => {
  it("shows a tooltip matching aria-label when the notifications bell receives focus", async () => {
    render(<TopHeader user={user} notificationCount={3} />);
    const bell = screen.getByRole("button", { name: /notifications, 3 unread/i });
    fireEvent.focus(bell);
    await waitFor(() => {
      const tooltip = document.querySelector('[data-slot="tooltip-content"]');
      expect(tooltip).not.toBeNull();
      expect(tooltip?.textContent).toMatch(/notifications, 3 unread/i);
    });
  });

  // The user menu trigger intentionally has no Tooltip wrap — the avatar +
  // name are already visible chrome on desktop, and wrapping a
  // DropdownMenuTrigger in Tooltip fires the tip on top of the open menu.
  // The aria-label still names the trigger for screen readers.
  it("names the user menu trigger via aria-label without a hover tooltip", () => {
    render(<TopHeader user={user} showNotifications={false} />);
    const trigger = screen.getByRole("button", { name: /user menu for test user/i });
    expect(trigger).toHaveAttribute("aria-label", "User menu for Test User");
    fireEvent.focus(trigger);
    const tooltip = document.querySelector('[data-slot="tooltip-content"]');
    expect(tooltip).toBeNull();
  });
});

describe("[WV019] TopHeader help button", () => {
  it("renders help button when showHelp is true", () => {
    render(<TopHeader user={user} showHelp onHelpClick={() => {}} />);
    const helpButton = screen.getByRole("button", { name: /ask ai for help/i });
    expect(helpButton).toBeInTheDocument();
  });

  it("does NOT render help button when showHelp is false", () => {
    render(<TopHeader user={user} showHelp={false} onHelpClick={() => {}} />);
    const helpButton = screen.queryByRole("button", { name: /ask ai for help/i });
    expect(helpButton).toBeNull();
  });

  it("calls onHelpClick when help button is clicked", () => {
    const onHelpClick = vi.fn();
    render(<TopHeader user={user} showHelp onHelpClick={onHelpClick} />);
    const helpButton = screen.getByRole("button", { name: /ask ai for help/i });
    fireEvent.click(helpButton);
    expect(onHelpClick).toHaveBeenCalledTimes(1);
  });

  it("shows tooltip matching aria-label when the help button receives focus", async () => {
    render(<TopHeader user={user} showHelp onHelpClick={() => {}} />);
    const helpButton = screen.getByRole("button", { name: /ask ai for help/i });
    fireEvent.focus(helpButton);
    await waitFor(() => {
      const tooltip = document.querySelector('[data-slot="tooltip-content"]');
      expect(tooltip).not.toBeNull();
      expect(tooltip?.textContent).toMatch(/ask ai for help/i);
    });
  });

  it("renders help as an external docs link (not a button) when helpHref is set", () => {
    render(<TopHeader user={user} showHelp helpHref="https://docs.example.com" />);
    const link = screen.getByRole("link", { name: /help documentation \(opens in new tab\)/i });
    expect(link).toHaveAttribute("href", "https://docs.example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.queryByRole("button", { name: /ask ai for help/i })).toBeNull();
  });
});

describe("TopHeader command-palette trigger", () => {
  it("opens the supplied search dialog and maintains a 44px touch target", () => {
    const onSearchClick = vi.fn();
    render(
      <TopHeader
        user={user}
        showNotifications={false}
        onSearchClick={onSearchClick}
        searchShortcutHint="Ctrl+K"
      />
    );

    const trigger = screen.getByRole("button", { name: "Open search" });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveClass("h-11");

    fireEvent.click(trigger);
    expect(onSearchClick).toHaveBeenCalledOnce();
  });
});
