import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TransformAiBuilder } from "./transform-ai-builder.js";

function setup(overrides: Partial<React.ComponentProps<typeof TransformAiBuilder>> = {}) {
  const onGenerate = vi.fn();
  const onFix = vi.fn();
  const onSelectedEventTypeChange = vi.fn();
  render(
    <TransformAiBuilder
      eventTypes={["coupon.hold", "tier.changed"]}
      selectedEventType=""
      onSelectedEventTypeChange={onSelectedEventTypeChange}
      onGenerate={onGenerate}
      onFix={onFix}
      {...overrides}
    />
  );
  return { onGenerate, onFix, onSelectedEventTypeChange };
}

describe("TransformAiBuilder", () => {
  it("submits the trimmed intent via Generate", () => {
    const { onGenerate } = setup();

    fireEvent.change(screen.getByLabelText("Describe the transformation"), {
      target: { value: "  drop the email field  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));

    expect(onGenerate).toHaveBeenCalledWith("drop the email field");
  });

  it("disables Generate until there is intent text", () => {
    setup();
    expect(screen.getByRole("button", { name: /^generate$/i })).toBeDisabled();
  });

  it("keeps Generate disabled while the event schema is still loading", () => {
    setup({ schemaLoading: true });
    fireEvent.change(screen.getByLabelText("Describe the transformation"), {
      target: { value: "drop the email" },
    });
    // Submitting now would send an undefined schema and lose grounding.
    expect(screen.getByRole("button", { name: /^generate$/i })).toBeDisabled();
  });

  it("offers the endpoint's event types for grounding", () => {
    const { onSelectedEventTypeChange } = setup();

    fireEvent.change(screen.getByLabelText("Ground on event (optional)"), {
      target: { value: "tier.changed" },
    });

    expect(onSelectedEventTypeChange).toHaveBeenCalledWith("tier.changed");
  });

  it("shows Fix with AI only when there's code to revise", () => {
    const { rerender } = render(
      <TransformAiBuilder
        eventTypes={[]}
        selectedEventType=""
        onSelectedEventTypeChange={vi.fn()}
        onGenerate={vi.fn()}
        onFix={vi.fn()}
        canFix={false}
      />
    );
    expect(screen.queryByRole("button", { name: /fix with ai/i })).not.toBeInTheDocument();

    rerender(
      <TransformAiBuilder
        eventTypes={[]}
        selectedEventType=""
        onSelectedEventTypeChange={vi.fn()}
        onGenerate={vi.fn()}
        onFix={vi.fn()}
        canFix
      />
    );
    expect(screen.getByRole("button", { name: /fix with ai/i })).toBeInTheDocument();
  });

  it("renders the abstention clarifying question without injecting", () => {
    setup({ clarifyingQuestion: "Which field holds the email?" });
    expect(screen.getByText("Which field holds the email?")).toBeInTheDocument();
  });

  it("surfaces an inline error", () => {
    setup({ error: "The AI builder is unavailable right now." });
    expect(screen.getByRole("alert")).toHaveTextContent("unavailable");
  });
});
