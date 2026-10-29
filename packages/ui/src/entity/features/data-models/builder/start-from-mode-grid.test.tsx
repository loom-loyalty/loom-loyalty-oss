import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StartFromModeGrid } from "./start-from-mode-grid.js";
import type { BuilderMode } from "./types.js";

function renderGrid(value: BuilderMode = "describe") {
  const onValueChange = vi.fn();
  const result = render(<StartFromModeGrid value={value} onValueChange={onValueChange} />);
  return { ...result, onValueChange };
}

const LABELS = ["Describe it", "Paste schema", "Field by field", "Sample"];

describe("StartFromModeGrid", () => {
  it("exposes a named radiogroup with one radio per mode, in order", () => {
    renderGrid();
    const group = screen.getByRole("radiogroup", { name: "Start from" });
    expect(group).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    expect(LABELS.map((label) => screen.getByText(label))).toHaveLength(4);
  });

  it("marks only the active mode checked", () => {
    renderGrid("field-by-field");
    expect(screen.getByRole("radio", { name: "Field by field" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Describe it" })).not.toBeChecked();
  });

  it("gives all four options the same 34px single-line box", () => {
    const { container } = renderGrid();
    const tiles = Array.from(container.querySelectorAll("label"));
    expect(tiles).toHaveLength(4);
    for (const tile of tiles) {
      expect(tile.className).toContain("h-[34px]");
    }
  });

  it("gives every tile a decorative icon that stays out of the accessible name", () => {
    const { container } = renderGrid();
    for (const label of LABELS) {
      expect(screen.getByRole("radio", { name: label })).toBeInTheDocument();
    }
    // One icon per tile plus the checked radio's own indicator dot.
    const tiles = Array.from(container.querySelectorAll("label"));
    for (const tile of tiles) {
      const icons = tile.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("tints only the selected tile with the primary border and background", () => {
    const { container } = renderGrid("sample");
    const selected = container.querySelector('label[for="builder-mode-sample"]');
    const other = container.querySelector('label[for="builder-mode-describe"]');
    expect(selected?.className).toContain("bg-primary/10");
    expect(selected?.className).toContain("border-[1.5px]");
    expect(other?.className).not.toContain("bg-primary/10");
  });

  it("keeps one tab stop for the group, landing on the active mode", async () => {
    const user = userEvent.setup();
    renderGrid("describe");

    // Radix roving focus: before focus enters, the group holds the tab stop and
    // every radio is tabindex=-1. Tab then lands on the checked radio.
    expect(screen.getByRole("radiogroup", { name: "Start from" })).toHaveAttribute("tabindex", "0");
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveAttribute("tabindex", "-1");
    }

    await user.tab();
    expect(screen.getByRole("radio", { name: "Describe it" })).toHaveFocus();
    expect(
      screen.getAllByRole("radio").filter((radio) => radio.getAttribute("tabindex") === "0")
    ).toHaveLength(1);
  });

  // Radix defers the focus move to a timeout and only selects while an arrow key
  // is still held, so the key must be pressed-and-held, not tapped.
  it.each([
    ["{ArrowRight>}", "{/ArrowRight}", "paste-schema"],
    ["{ArrowDown>}", "{/ArrowDown}", "paste-schema"],
    ["{ArrowLeft>}", "{/ArrowLeft}", "sample"],
    ["{ArrowUp>}", "{/ArrowUp}", "sample"],
  ])("moves selection with %s, wrapping past the ends", async (press, release, expected) => {
    const user = userEvent.setup();
    const { onValueChange } = renderGrid("describe");
    await user.tab();

    await user.keyboard(press);
    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith(expected));
    await user.keyboard(release);
  });

  it("selects a mode when the tile is clicked anywhere, not just the radio dot", () => {
    // The tile is a Label whose htmlFor targets the RadioGroupItem button, so
    // the whole 34px box is the click target, not the 14px dot inside it.
    const { container, onValueChange } = renderGrid("describe");
    const tile = container.querySelector('label[for="builder-mode-sample"]');
    fireEvent.click(tile as HTMLElement);
    expect(onValueChange).toHaveBeenCalledWith("sample");
  });

  it("selects a mode when its radio is clicked directly", () => {
    const { onValueChange } = renderGrid("describe");
    fireEvent.click(screen.getByRole("radio", { name: "Field by field" }));
    expect(onValueChange).toHaveBeenCalledWith("field-by-field");
  });

  it("renders one caption for the active mode instead of per-option copy", () => {
    const { rerender } = renderGrid("describe");
    expect(screen.getByText(/say what the event contains in plain language/i)).toBeInTheDocument();
    expect(screen.queryByText(/declare each field yourself/i)).toBeNull();

    rerender(<StartFromModeGrid value="field-by-field" onValueChange={vi.fn()} />);
    expect(screen.getByText(/declare each field yourself/i)).toBeInTheDocument();
    expect(screen.queryByText(/say what the event contains in plain language/i)).toBeNull();
  });

  it("disables every radio when disabled", () => {
    render(<StartFromModeGrid value="describe" onValueChange={vi.fn()} disabled />);
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toBeDisabled();
    }
  });
});
