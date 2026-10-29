import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConsentCheckbox } from "./consent-checkbox";

describe("ConsentCheckbox", () => {
  it("renders a native, unchecked checkbox named by its statement", () => {
    render(
      <ConsentCheckbox checked={false} onCheckedChange={() => {}}>
        I agree to the terms
      </ConsentCheckbox>
    );
    const box = screen.getByRole("checkbox", { name: "I agree to the terms" });
    expect(box.tagName).toBe("INPUT");
    expect(box).toHaveAttribute("type", "checkbox");
    expect(box).not.toBeChecked();
  });

  it("reports changes when the statement is clicked", async () => {
    const onCheckedChange = vi.fn();
    render(
      <ConsentCheckbox checked={false} onCheckedChange={onCheckedChange}>
        I agree to the terms
      </ConsentCheckbox>
    );
    await userEvent.click(screen.getByText("I agree to the terms"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("links its description and an external description", () => {
    render(
      <>
        <p id="docs">The documents</p>
        <ConsentCheckbox
          checked
          onCheckedChange={() => {}}
          describedBy="docs"
          description="Recorded with your name and title"
        >
          I agree
        </ConsentCheckbox>
      </>
    );
    expect(screen.getByRole("checkbox", { name: "I agree" })).toHaveAccessibleDescription(
      "The documents Recorded with your name and title"
    );
  });

  it("does not change while disabled", async () => {
    const onCheckedChange = vi.fn();
    render(
      <ConsentCheckbox checked={false} onCheckedChange={onCheckedChange} disabled>
        I agree
      </ConsentCheckbox>
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "I agree" }));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
