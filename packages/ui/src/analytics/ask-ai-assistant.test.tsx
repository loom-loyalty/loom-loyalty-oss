import { axe } from "@loom-loyalty/test-utils/axe";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AskAiAssistant } from "./ask-ai-assistant";

describe("AskAiAssistant", () => {
  it("submits a typed question (trimmed) via the Ask button", () => {
    const onGenerate = vi.fn();
    render(<AskAiAssistant onGenerate={onGenerate} />);
    const input = screen.getByLabelText(/ask your data a question/i);
    fireEvent.change(input, { target: { value: "  top spenders  " } });
    fireEvent.click(screen.getByRole("button", { name: /^ask$/i }));
    expect(onGenerate).toHaveBeenCalledWith("top spenders");
  });

  it("disables Ask when the input is empty", () => {
    render(<AskAiAssistant onGenerate={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^ask$/i })).toBeDisabled();
  });

  it("submits via Enter (form submit) too", () => {
    const onGenerate = vi.fn();
    render(<AskAiAssistant onGenerate={onGenerate} />);
    const input = screen.getByLabelText(/ask your data a question/i);
    fireEvent.change(input, { target: { value: "events today" } });
    fireEvent.submit(input.closest("form")!);
    expect(onGenerate).toHaveBeenCalledWith("events today");
  });

  it("shows Thinking… and disables the button while loading", () => {
    render(<AskAiAssistant onGenerate={vi.fn()} isLoading />);
    expect(screen.getByRole("button", { name: /thinking/i })).toBeDisabled();
  });

  it("renders an inline error with role=alert", () => {
    render(<AskAiAssistant onGenerate={vi.fn()} error="Too many requests." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Too many requests.");
  });

  it("renders the clarifying-question card on abstain", () => {
    render(
      <AskAiAssistant
        onGenerate={vi.fn()}
        clarifyingQuestion="Which metric do you want?"
        explanation="The ask was too vague."
      />
    );
    expect(screen.getByText("Which metric do you want?")).toBeInTheDocument();
  });

  it("renders assumptions and the explanation panel together", () => {
    render(
      <AskAiAssistant
        onGenerate={vi.fn()}
        explanation="Counts all events."
        assumptions={["Applied FINAL to deduplicate mv_events."]}
      />
    );
    expect(screen.getByText("Counts all events.")).toBeInTheDocument();
    expect(screen.getByText("Applied FINAL to deduplicate mv_events.")).toBeInTheDocument();
  });

  it("hides the assumptions banner while a new query is loading", () => {
    // Stale assumptions from a prior query must not linger during a new fetch
    // (matches the gating of every other output section).
    render(<AskAiAssistant onGenerate={vi.fn()} assumptions={["stale assumption"]} isLoading />);
    expect(screen.queryByText("stale assumption")).not.toBeInTheDocument();
  });

  it("calls onExplain when enabled and disables it without SQL", () => {
    const onExplain = vi.fn();
    const { rerender } = render(
      <AskAiAssistant onGenerate={vi.fn()} onExplain={onExplain} canExplain={false} />
    );
    expect(screen.getByRole("button", { name: /explain sql/i })).toBeDisabled();

    rerender(<AskAiAssistant onGenerate={vi.fn()} onExplain={onExplain} canExplain />);
    fireEvent.click(screen.getByRole("button", { name: /explain sql/i }));
    expect(onExplain).toHaveBeenCalledTimes(1);
  });

  it("shows the refinement indicator only when there's a previous question", () => {
    const { rerender } = render(<AskAiAssistant onGenerate={vi.fn()} />);
    expect(screen.queryByText(/continuing from/i)).not.toBeInTheDocument();

    rerender(
      <AskAiAssistant onGenerate={vi.fn()} previousQuestion="show customers and their tier" />
    );
    expect(screen.getByText(/continuing from/i)).toBeInTheDocument();
    expect(screen.getByText("show customers and their tier")).toBeInTheDocument();
  });

  it("starts a new conversation when requested", () => {
    const onNewConversation = vi.fn();
    render(
      <AskAiAssistant
        onGenerate={vi.fn()}
        previousQuestion="show customers and their tier"
        onNewConversation={onNewConversation}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /start new question/i }));
    expect(onNewConversation).toHaveBeenCalledTimes(1);
  });

  it("does not reset a conversation while a generation is in flight", () => {
    render(
      <AskAiAssistant
        onGenerate={vi.fn()}
        previousQuestion="show customers and their tier"
        onNewConversation={vi.fn()}
        isLoading
      />
    );
    expect(screen.getByRole("button", { name: /start new question/i })).toBeDisabled();
  });

  it("has no axe violations in the default state", async () => {
    const { container } = render(
      <AskAiAssistant onGenerate={vi.fn()} onExplain={vi.fn()} canExplain />
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no axe violations while refining a conversation", async () => {
    const { container } = render(
      <AskAiAssistant
        onGenerate={vi.fn()}
        previousQuestion="show customers and their tier"
        onNewConversation={vi.fn()}
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
