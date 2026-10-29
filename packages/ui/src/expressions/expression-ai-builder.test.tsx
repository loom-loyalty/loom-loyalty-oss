import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExpressionAiBuilder } from "./expression-ai-builder.js";

function setup(overrides: Partial<React.ComponentProps<typeof ExpressionAiBuilder>> = {}) {
  const onGenerate = vi.fn();
  const onFix = vi.fn();
  render(
    <ExpressionAiBuilder surface="event" onGenerate={onGenerate} onFix={onFix} {...overrides} />
  );
  return { onGenerate, onFix };
}

describe("ExpressionAiBuilder — surface copy", () => {
  it("shows the event-surface label and placeholder by default", () => {
    setup({ surface: "event" });
    expect(screen.getByLabelText("Describe when this rule fires")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("e.g. order total is over $100 and the customer is a VIP")
    ).toBeInTheDocument();
  });

  it("shows the customer-surface label and placeholder by default", () => {
    setup({ surface: "customer" });
    expect(screen.getByLabelText("Describe this segment in plain language")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("e.g. customers who bought 3+ times in the last 30 days")
    ).toBeInTheDocument();
  });

  it("honors label/placeholder overrides", () => {
    setup({ label: "Custom label", placeholder: "Custom placeholder" });
    expect(screen.getByLabelText("Custom label")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Custom placeholder")).toBeInTheDocument();
  });
});

describe("ExpressionAiBuilder — Generate", () => {
  it("submits the trimmed prompt via Generate", () => {
    const { onGenerate } = setup();
    fireEvent.change(screen.getByLabelText("Describe when this rule fires"), {
      target: { value: "  order total over $100  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
    expect(onGenerate).toHaveBeenCalledWith("order total over $100");
  });

  it("disables Generate until there is prompt text", () => {
    setup();
    expect(screen.getByRole("button", { name: /^generate$/i })).toBeDisabled();
  });

  it("renders no nested <form> (safe to embed inside another form, e.g. a FormSheet)", () => {
    // Regression guard: a nested <form> is invalid HTML, so a submit button would
    // submit the OUTER form (the audience FormSheet) instead of generating.
    const { container } = render(
      <ExpressionAiBuilder surface="customer" onGenerate={vi.fn()} onFix={vi.fn()} canFix />
    );
    expect(container.querySelector("form")).toBeNull();
    expect(screen.getByRole("button", { name: /^generate$/i })).toHaveAttribute("type", "button");
  });

  it("disables Generate and marks aria-busy while loading", () => {
    setup({ isLoading: true });
    const textarea = screen.getByLabelText("Describe when this rule fires");
    fireEvent.change(textarea, { target: { value: "order total over $100" } });

    const button = screen.getByRole("button", { name: /generating/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(textarea).toBeDisabled();
    expect(textarea).toHaveAttribute("aria-busy", "true");
  });

  it("blocks submit while the grounding schema is still resolving", () => {
    setup({ isResolvingSchema: true });
    fireEvent.change(screen.getByLabelText("Describe when this rule fires"), {
      target: { value: "order total over $100" },
    });
    expect(screen.getByRole("button", { name: /^generate$/i })).toBeDisabled();
  });
});

describe("ExpressionAiBuilder — Fix with AI", () => {
  it("shows Fix with AI only when canFix is true", () => {
    const { rerender } = render(
      <ExpressionAiBuilder surface="event" onGenerate={vi.fn()} onFix={vi.fn()} canFix={false} />
    );
    expect(screen.queryByRole("button", { name: /fix with ai/i })).not.toBeInTheDocument();

    rerender(<ExpressionAiBuilder surface="event" onGenerate={vi.fn()} onFix={vi.fn()} canFix />);
    expect(screen.getByRole("button", { name: /fix with ai/i })).toBeInTheDocument();
  });

  it("submits the trimmed prompt via Fix with AI", () => {
    const { onFix } = setup({ canFix: true });
    fireEvent.change(screen.getByLabelText("Describe when this rule fires"), {
      target: { value: "  also require VIP status  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /fix with ai/i }));
    expect(onFix).toHaveBeenCalledWith("also require VIP status");
  });

  it("does not call Fix with AI while blocked by an empty prompt", () => {
    const { onFix } = setup({ canFix: true });
    fireEvent.click(screen.getByRole("button", { name: /fix with ai/i }));
    expect(onFix).not.toHaveBeenCalled();
  });
});

describe("ExpressionAiBuilder — error / abstain / assumptions / explanation", () => {
  it("surfaces an inline error with role=alert", () => {
    setup({ error: "The AI builder is unavailable right now." });
    expect(screen.getByRole("alert")).toHaveTextContent("unavailable");
  });

  it("renders the abstention clarifying question without a generated tree", () => {
    setup({ clarifyingQuestion: "Which field holds the order total?" });
    expect(screen.getByText("Which field holds the order total?")).toBeInTheDocument();
    expect(screen.getByText("A quick question")).toBeInTheDocument();
  });

  it("renders assumptions as a list under role=note", () => {
    setup({ assumptions: ["Assumed USD currency.", "Assumed active tier."] });
    const note = screen.getByRole("note", { name: "Assumptions the assistant made" });
    expect(note).toHaveTextContent("Assumed USD currency.");
    expect(note).toHaveTextContent("Assumed active tier.");
  });

  it("hides assumptions when a clarifying question is present", () => {
    setup({
      clarifyingQuestion: "Which field holds the order total?",
      assumptions: ["Assumed USD currency."],
    });
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("renders the explanation panel on success", () => {
    setup({ explanation: "Fires when the order total exceeds $100." });
    expect(screen.getByText("Fires when the order total exceeds $100.")).toBeInTheDocument();
  });

  it("announces success via the live region", () => {
    setup({ generatedAnnouncement: "Expression generated — review and save." });
    expect(screen.getByText("Expression generated — review and save.")).toBeInTheDocument();
  });
});

describe("ExpressionAiBuilder — keyboard dismiss", () => {
  it("dismisses the clarifying-question callout on Escape", () => {
    setup({ clarifyingQuestion: "Which field holds the order total?" });
    expect(screen.getByText("A quick question")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByText("A quick question"), { key: "Escape" });

    expect(screen.queryByText("A quick question")).not.toBeInTheDocument();
  });

  it("dismisses the assumptions callout on Escape", () => {
    setup({ assumptions: ["Assumed USD currency."] });
    expect(screen.getByRole("note")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("note"), { key: "Escape" });

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("resets the dismissal when a new clarifying question arrives", () => {
    const { rerender } = render(
      <ExpressionAiBuilder surface="event" onGenerate={vi.fn()} clarifyingQuestion="Q1" />
    );
    fireEvent.keyDown(screen.getByText("A quick question"), { key: "Escape" });
    expect(screen.queryByText("A quick question")).not.toBeInTheDocument();

    rerender(<ExpressionAiBuilder surface="event" onGenerate={vi.fn()} clarifyingQuestion="Q2" />);
    expect(screen.getByText("Q2")).toBeInTheDocument();
  });

  it("re-surfaces a dismissed callout when the same prompt is re-submitted", () => {
    const onGenerate = vi.fn();
    render(
      <ExpressionAiBuilder surface="event" onGenerate={onGenerate} clarifyingQuestion="Same Q" />
    );
    fireEvent.keyDown(screen.getByText("A quick question"), { key: "Escape" });
    expect(screen.queryByText("A quick question")).not.toBeInTheDocument();

    // Re-submitting (even the same intent) un-dismisses so a repeated identical
    // abstention isn't left silently hidden.
    fireEvent.change(screen.getByLabelText("Describe when this rule fires"), {
      target: { value: "same intent" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
    expect(onGenerate).toHaveBeenCalledWith("same intent");
    expect(screen.getByText("A quick question")).toBeInTheDocument();
  });
});

describe("ExpressionAiBuilder — schema-resolving state", () => {
  it("shows a resolving status and blocks submit while the grounding schema loads", () => {
    const onGenerate = vi.fn();
    render(
      <ExpressionAiBuilder surface="event" onGenerate={onGenerate} isResolvingSchema={true} />
    );
    expect(screen.getByText("Preparing field suggestions…")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Describe when this rule fires"), {
      target: { value: "orders over 100" },
    });
    // Generate is disabled while resolving — clicking must not fire onGenerate.
    fireEvent.click(screen.getByRole("button", { name: /^generate$/i }));
    expect(onGenerate).not.toHaveBeenCalled();
  });
});
