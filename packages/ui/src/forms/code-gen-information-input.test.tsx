import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CodeGenInformationInput } from "./code-gen-information-input";

describe("[audit] CodeGenInformationInput check digit algorithm help", () => {
  // GENERATED type unlocks the algorithm/check-digit section
  const generatedValue = { type: "GENERATED" as const };

  it("renders an info icon trigger next to the Check Digit Algorithm label", () => {
    render(<CodeGenInformationInput value={generatedValue} showCard={false} />);
    expect(screen.getByRole("button", { name: /check digit algorithm help/i })).toBeInTheDocument();
  });

  it("links the Check Digit Algorithm select to a screen-reader description via aria-describedby", () => {
    const { container } = render(
      <CodeGenInformationInput value={generatedValue} showCard={false} />
    );
    // The Select trigger is identified by the Label's htmlFor target.
    const label = screen.getByText("Check Digit Algorithm");
    const triggerId = label.getAttribute("for");
    expect(triggerId).toBeTruthy();
    const trigger = container.querySelector(`#${CSS.escape(triggerId!)}`);
    expect(trigger).not.toBeNull();
    const describedBy = trigger?.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const desc = container.querySelector(`#${CSS.escape(describedBy!)}`);
    expect(desc).not.toBeNull();
    const text = desc?.textContent ?? "";
    expect(text).toMatch(/Mod 10/i);
    expect(text).toMatch(/Luhn/i);
  });

  it("opens the tooltip with Mod 10 and Luhn descriptions on focus of the trigger", async () => {
    render(<CodeGenInformationInput value={generatedValue} showCard={false} />);
    const trigger = screen.getByRole("button", { name: /check digit algorithm help/i });
    fireEvent.focus(trigger);
    await waitFor(() => {
      const tooltip = document.querySelector('[data-slot="tooltip-content"]');
      expect(tooltip).not.toBeNull();
      const text = tooltip?.textContent ?? "";
      expect(text).toMatch(/Mod 10/i);
      expect(text).toMatch(/Luhn/i);
    });
  });
});

describe("[audit] CodeGenInformationInput hideTypeSelector", () => {
  const generatedValue = { type: "GENERATED" as const };

  it("renders the Code Type select by default (hideTypeSelector omitted)", () => {
    render(<CodeGenInformationInput value={generatedValue} showCard={false} />);
    expect(screen.getByLabelText(/Code Type/i)).toBeInTheDocument();
    expect(document.querySelector("#codeGenType")).not.toBeNull();
  });

  it("hides the Code Type select when hideTypeSelector is true", () => {
    render(<CodeGenInformationInput value={generatedValue} showCard={false} hideTypeSelector />);
    expect(screen.queryByLabelText(/Code Type/i)).toBeNull();
    expect(document.querySelector("#codeGenType")).toBeNull();
  });

  it("still renders the conditional algorithm sub-fields for a GENERATED value when hideTypeSelector is true", () => {
    render(<CodeGenInformationInput value={generatedValue} showCard={false} hideTypeSelector />);
    expect(screen.getByLabelText("Prefix")).toBeInTheDocument();
    expect(screen.getByLabelText("Suffix")).toBeInTheDocument();
    expect(screen.getByText("Part 1 Algorithm")).toBeInTheDocument();
    expect(screen.getByLabelText("Part 1 Length")).toBeInTheDocument();
    expect(screen.getByText("Part 2 Algorithm")).toBeInTheDocument();
    expect(screen.getByLabelText("Part 2 Length")).toBeInTheDocument();
    expect(screen.getByText("Check Digit Algorithm")).toBeInTheDocument();
  });

  it("hides the algorithm sub-fields for a non-GENERATED value even when hideTypeSelector is true", () => {
    render(
      <CodeGenInformationInput value={{ type: "PROVIDED" }} showCard={false} hideTypeSelector />
    );
    expect(screen.queryByLabelText("Prefix")).toBeNull();
    expect(screen.queryByText("Check Digit Algorithm")).toBeNull();
  });

  it("still calls onChange for sub-field edits when hideTypeSelector is true", () => {
    const handleChange = vi.fn();
    render(
      <CodeGenInformationInput
        value={generatedValue}
        onChange={handleChange}
        showCard={false}
        hideTypeSelector
      />
    );
    fireEvent.change(screen.getByLabelText("Prefix"), { target: { value: "ACC-" } });
    expect(handleChange).toHaveBeenCalledWith({ type: "GENERATED", prefix: "ACC-" });
  });
});
