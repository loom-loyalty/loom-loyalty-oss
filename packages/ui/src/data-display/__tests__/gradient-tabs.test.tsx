import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { GradientTabs, type TabItem } from "../gradient-tabs";

const PRIMARY: TabItem[] = [
  { id: "overview", label: "Overview" },
  { id: "membership", label: "Membership" },
];
const OVERFLOW: TabItem[] = [
  { id: "promotions", label: "Promotions" },
  { id: "preferences", label: "Preferences" },
];

function Harness({ initial = "overview" }: { initial?: string }) {
  const [active, setActive] = useState(initial);
  return (
    <GradientTabs
      tabs={PRIMARY}
      overflowTabs={OVERFLOW}
      activeTab={active}
      onTabChange={setActive}
      ariaLabel="Sections"
      moreLabel="More sections"
    />
  );
}

function tabNames() {
  return within(screen.getByRole("tablist", { name: "Sections" }))
    .getAllByRole("tab")
    .map((tab) => tab.textContent);
}

describe("GradientTabs overflow menu", () => {
  it("renders no More menu without overflow tabs", () => {
    render(<GradientTabs tabs={PRIMARY} activeTab="overview" onTabChange={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /more/i })).not.toBeInTheDocument();
  });

  it("shows only the primary tabs, and lists the rest under More", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(tabNames()).toEqual(["Overview", "Membership"]);
    await user.click(screen.getByRole("button", { name: "More sections" }));
    const menu = screen.getByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent)
    ).toEqual(["Promotions", "Preferences"]);
  });

  it("opens a tab picked from More and shows it as the selected tab", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "More sections" }));
    await user.click(screen.getByRole("menuitem", { name: "Preferences" }));

    expect(tabNames()).toEqual(["Overview", "Membership", "Preferences"]);
    expect(screen.getByRole("tab", { name: "Preferences" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tab", { name: "Preferences" })).toHaveAttribute(
      "aria-controls",
      "tabpanel-preferences"
    );
    // The open tab leaves the menu, so it is never listed twice.
    await user.click(screen.getByRole("button", { name: "More sections" }));
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Promotions"]);
  });

  it("drops a picked overflow tab from the row once a primary tab is chosen", async () => {
    const user = userEvent.setup();
    render(<Harness initial="preferences" />);

    expect(tabNames()).toEqual(["Overview", "Membership", "Preferences"]);
    await user.click(screen.getByRole("tab", { name: "Overview" }));
    expect(tabNames()).toEqual(["Overview", "Membership"]);
  });

  it("gives the More button and its items a 44px touch target", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole("button", { name: "More sections" })).toHaveClass("min-h-11");
    await user.click(screen.getByRole("button", { name: "More sections" }));
    for (const item of screen.getAllByRole("menuitem")) expect(item).toHaveClass("min-h-11");
  });

  it("moves focus with the selection when arrowing off an opened overflow tab", async () => {
    const user = userEvent.setup();
    render(<Harness initial="preferences" />);

    screen.getByRole("tab", { name: "Preferences" }).focus();
    await user.keyboard("{ArrowRight}");
    // Preferences leaves the row, so focus must land on the newly selected tab, not the page.
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Membership" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Membership" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });
});
