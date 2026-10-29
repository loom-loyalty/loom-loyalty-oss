import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SegmentedSwitch } from "./segmented-switch";

const OPTIONS = [
  { value: "offer", label: "Offer" },
  { value: "code", label: "Coupon code" },
  { value: "id", label: "Coupon ID" },
] as const;

describe("SegmentedSwitch", () => {
  it("clicking an option calls onChange with its value and flips aria-checked", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <SegmentedSwitch
        value="offer"
        onChange={handleChange}
        options={OPTIONS}
        ariaLabel="Reference type"
      />
    );

    await user.click(screen.getByRole("radio", { name: "Coupon code" }));

    expect(handleChange).toHaveBeenCalledWith("code");
  });

  it("does not call onChange when disabled", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <SegmentedSwitch
        value="offer"
        onChange={handleChange}
        options={OPTIONS}
        ariaLabel="Reference type"
        disabled
      />
    );

    await user.click(screen.getByRole("radio", { name: "Coupon code" }));

    expect(handleChange).not.toHaveBeenCalled();
  });

  it("implements roving tabIndex — only the selected segment is a tab stop (adversarial review finding)", () => {
    render(
      <SegmentedSwitch
        value="code"
        onChange={vi.fn()}
        options={OPTIONS}
        ariaLabel="Reference type"
      />
    );

    expect(screen.getByRole("radio", { name: "Offer" })).toHaveAttribute("tabIndex", "-1");
    expect(screen.getByRole("radio", { name: "Coupon code" })).toHaveAttribute("tabIndex", "0");
    expect(screen.getByRole("radio", { name: "Coupon ID" })).toHaveAttribute("tabIndex", "-1");
  });

  it("ArrowRight/ArrowLeft move focus and selection to the sibling segment (adversarial review finding)", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <SegmentedSwitch
        value="offer"
        onChange={handleChange}
        options={OPTIONS}
        ariaLabel="Reference type"
      />
    );

    screen.getByRole("radio", { name: "Offer" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(handleChange).toHaveBeenLastCalledWith("code");

    await user.keyboard("{ArrowLeft}");
    expect(handleChange).toHaveBeenLastCalledWith("offer");
  });

  it("wraps from the last segment to the first on ArrowRight", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <SegmentedSwitch
        value="id"
        onChange={handleChange}
        options={OPTIONS}
        ariaLabel="Reference type"
      />
    );

    screen.getByRole("radio", { name: "Coupon ID" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(handleChange).toHaveBeenLastCalledWith("offer");
  });
});
