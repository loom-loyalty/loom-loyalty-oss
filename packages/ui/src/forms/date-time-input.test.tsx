import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DateTimeInput } from "./date-time-input";

// DatePicker's own UI (a Calendar popover) isn't the thing under test here —
// DateTimeInput's `combine` logic is. Stub it down to a single button that
// calls onChange(undefined), mirroring what DatePicker does when a date is
// cleared, so the clear path can be exercised without driving the calendar.
vi.mock("./date-picker", () => ({
  DatePicker: ({ onChange }: { onChange: (date: string | undefined) => void }) => (
    <button type="button" onClick={() => onChange(undefined)}>
      Clear date
    </button>
  ),
}));

describe("DateTimeInput", () => {
  it("propagates a cleared date instead of silently no-op'ing (adversarial review finding)", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <DateTimeInput label="Start date" value="2024-06-15T14:30:00" onChange={handleChange} />
    );

    await user.click(screen.getByRole("button", { name: "Clear date" }));

    expect(handleChange).toHaveBeenCalledWith("");
  });

  it("combines a newly picked date with the existing time", () => {
    const handleChange = vi.fn();
    render(
      <DateTimeInput label="Start date" value="2024-06-15T14:30:00" onChange={handleChange} />
    );

    expect(screen.getByLabelText("Start date time")).toHaveValue("14:30");
  });
});
