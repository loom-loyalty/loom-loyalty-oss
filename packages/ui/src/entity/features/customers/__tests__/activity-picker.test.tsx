/**
 * ActivityPicker behavior suite (U4).
 *
 * The eligibility filter is the load-bearing assertion here: the picker is the
 * last place an engine-announced activity can be withheld, and the registry can
 * hand it one by mistake.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActivityPicker } from "../record-activity/activity-picker.js";
import type { CareActivityOption } from "../record-activity/types.js";

const ACTIVITIES: CareActivityOption[] = [
  { code: "hotel.stay", name: "Hotel stay", description: "A completed stay" },
  { code: "hotel.cancellation", name: "Hotel cancellation" },
  { code: "transaction", name: "Purchase" },
  { code: "laundromat.checkin", name: "Laundromat visit" },
];

function renderPicker(overrides: Partial<Parameters<typeof ActivityPicker>[0]> = {}) {
  const onSelect = vi.fn();
  const result = render(
    <ActivityPicker
      activities={ACTIVITIES}
      selectedCode={null}
      onSelect={onSelect}
      {...overrides}
    />
  );
  return { ...result, onSelect };
}

async function openList() {
  fireEvent.click(screen.getByRole("combobox"));
  await waitFor(() => {
    expect(screen.getByPlaceholderText("Search activities…")).toBeInTheDocument();
  });
}

describe("ActivityPicker", () => {
  it("does not render an engine-announced activity present in the supplied rows", async () => {
    // Covers AE7. `tier.issued` is something the engine announces about itself;
    // a registry row for it on the care surface is a mistake, and the picker
    // must withhold it rather than trust the row.
    renderPicker({
      activities: [...ACTIVITIES, { code: "tier.issued", name: "Tier reached" }],
    });
    await openList();

    expect(screen.queryByText("Tier reached")).not.toBeInTheDocument();
    expect(screen.getByText("Hotel stay")).toBeInTheDocument();
  });

  it("withholds an activity already served by a bespoke sheet", async () => {
    renderPicker({
      activities: [...ACTIVITIES, { code: "tier.issue", name: "Assign a tier" }],
    });
    await openList();

    expect(screen.queryByText("Assign a tier")).not.toBeInTheDocument();
  });

  it("filters the list to matching activities as the agent types", async () => {
    renderPicker();
    await openList();

    fireEvent.change(screen.getByPlaceholderText("Search activities…"), {
      target: { value: "laundr" },
    });

    await waitFor(() => {
      expect(screen.getByText("Laundromat visit")).toBeInTheDocument();
    });
    expect(screen.queryByText("Hotel stay")).not.toBeInTheDocument();
  });

  it("reports the chosen activity's code and collapses the trigger to its name", async () => {
    const { onSelect, rerender } = renderPicker();
    await openList();

    fireEvent.click(screen.getByText("Hotel stay"));
    expect(onSelect).toHaveBeenCalledWith("hotel.stay");

    rerender(
      <ActivityPicker activities={ACTIVITIES} selectedCode="hotel.stay" onSelect={onSelect} />
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("Hotel stay");
    expect(trigger).not.toHaveTextContent("Choose what happened");
  });

  it("presents a supplied suggestion in its own group above the others", async () => {
    renderPicker({ suggestedCode: "hotel.stay" });
    await openList();

    const suggestedGroup = screen
      .getByText("Best match for what you described")
      .closest("[cmdk-group]");
    expect(suggestedGroup).not.toBeNull();
    expect(within(suggestedGroup as HTMLElement).getByText("Hotel stay")).toBeInTheDocument();

    // The suggestion is not duplicated into its domain group.
    expect(screen.getAllByText("Hotel stay")).toHaveLength(1);
  });

  it("reports no activity as selected while a suggestion is present and unchosen", async () => {
    // Covers AE4's guarantee at the picker level: a suggestion routes, it never
    // applies. Nothing is selected until the agent selects it.
    const { onSelect } = renderPicker({ suggestedCode: "hotel.stay" });

    expect(screen.getByRole("combobox")).toHaveTextContent("Choose what happened");
    expect(onSelect).not.toHaveBeenCalled();

    await openList();
    // The check mark marks selection; nothing carries it yet.
    const items = screen.getAllByRole("option");
    for (const item of items) {
      expect(item.querySelector(".opacity-100")).toBeNull();
    }
  });

  it("groups by the activity's domain and sorts by name within a group", async () => {
    renderPicker();
    await openList();

    const hotelGroup = screen.getByText("Hotel").closest("[cmdk-group]");
    expect(hotelGroup).not.toBeNull();
    const names = within(hotelGroup as HTMLElement)
      .getAllByRole("option")
      .map((el) => el.textContent);
    expect(names[0]).toContain("Hotel cancellation");
    expect(names[1]).toContain("Hotel stay");
  });

  it("is keyboard reachable and gives every entry an accessible name", async () => {
    renderPicker();
    const trigger = screen.getByRole("combobox");

    expect(trigger).toHaveAttribute("aria-label", "Activity");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    // A native button, so Enter and Space activate it without a key handler of
    // our own, and it is in the tab order without an explicit tabindex.
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).not.toHaveAttribute("tabindex", "-1");
    trigger.focus();
    expect(trigger).toHaveFocus();

    await openList();
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    // Focus moves into the search box, so typing and arrow keys reach the list
    // without a pointer.
    const search = screen.getByPlaceholderText("Search activities…");
    await waitFor(() => {
      expect(search).toHaveFocus();
    });

    const options = screen.getAllByRole("option");
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(option.textContent?.trim()).not.toBe("");
    }

    // cmdk marks the keyboard-active option; arrow keys move it.
    fireEvent.keyDown(search, { key: "ArrowDown" });
    await waitFor(() => {
      expect(
        screen.getAllByRole("option").some((o) => o.getAttribute("data-selected") === "true")
      ).toBe(true);
    });
  });

  it("stays operable while the offered list is still loading", async () => {
    // A disabled trigger cannot be opened and cannot explain itself, so a slow
    // or hanging discovery query would leave the surface permanently
    // un-interactive. Regression test for exactly that: CI caught the picker
    // stuck disabled for a full 5-minute test timeout.
    renderPicker({ activities: [], loading: true });

    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeEnabled();
    expect(trigger).toHaveTextContent(/Loading activities/i);

    await openList();
    // Both the trigger and the empty list say so; the list message is the one
    // an agent reads while the popover is open.
    expect(screen.getAllByText("Loading activities…").length).toBeGreaterThan(0);
  });

  it("still hard-disables when explicitly told to", () => {
    renderPicker({ disabled: true });
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("has a trigger tall enough to be a comfortable touch target", () => {
    renderPicker();
    expect(screen.getByRole("combobox").className).toContain("min-h-11");
  });

  it("reports no match rather than an empty list when a search finds nothing", async () => {
    renderPicker();
    await openList();

    fireEvent.change(screen.getByPlaceholderText("Search activities…"), {
      target: { value: "zzzzz" },
    });

    await waitFor(() => {
      expect(screen.getByText("No activity matches that search.")).toBeInTheDocument();
    });
  });
});
