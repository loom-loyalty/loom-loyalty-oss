import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const triggerActionSpy = vi.fn();

vi.mock("@openuidev/react-lang", () => ({
  defineComponent: (config: Record<string, unknown>) => ({
    ...config,
    ref: z.any(),
  }),
  useTriggerAction: () => triggerActionSpy,
}));

import { PendingExtractionList } from "../components/onboarding/pending-extraction-list";

const Component = PendingExtractionList.component;
const renderNode = (value: unknown) => <span>{String(value)}</span>;

const low = (field: string, confidence = 0.5, value: unknown = "draft text") => ({
  expectedField: field,
  value,
  confidence,
});

const high = (field: string, value: unknown = "high-conf value") => ({
  expectedField: field,
  value,
  confidence: 0.95,
});

describe("PendingExtractionList", () => {
  beforeEach(() => triggerActionSpy.mockReset());

  it("renders the no-low-confidence state when every extraction is high confidence", () => {
    render(
      <Component
        props={{ extractions: [high("program.description"), high("marketing")] }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByText(/all extracted values are high confidence/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders only the low-confidence subset as acknowledgement rows", () => {
    render(
      <Component
        props={{
          extractions: [
            high("safe.field"),
            low("description", 0.5, "Coffee shop loyalty program"),
            low("marketing.notes", 0.3),
          ],
        }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByText("description")).toBeInTheDocument();
    expect(screen.getByText("marketing.notes")).toBeInTheDocument();
    expect(screen.queryByText("safe.field")).not.toBeInTheDocument();
  });

  it("renders confidence as a percentage next to each field", () => {
    render(
      <Component props={{ extractions: [low("description", 0.5)] }} renderNode={renderNode} />
    );
    expect(screen.getByText(/\(50%\)/)).toBeInTheDocument();
  });

  it("submit button is disabled until every low-confidence row is acknowledged", () => {
    render(
      <Component
        props={{
          extractions: [low("a"), low("b")],
        }}
        renderNode={renderNode}
      />
    );
    const submit = screen.getByRole("button", { name: /continue/i });
    expect(submit).toBeDisabled();

    // Acknowledge the first row — still disabled.
    fireEvent.click(screen.getAllByRole("button", { name: /use a anyway/i })[0]!);
    expect(submit).toBeDisabled();

    // Acknowledge the second — now enabled.
    fireEvent.click(screen.getAllByRole("button", { name: /use b anyway/i })[0]!);
    expect(submit).toBeEnabled();
  });

  it("submit triggers an action carrying the acknowledged-field set", () => {
    render(
      <Component
        props={{
          extractions: [low("description"), low("marketing.notes")],
        }}
        renderNode={renderNode}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /use description anyway/i }));
    fireEvent.click(screen.getByRole("button", { name: /use marketing.notes anyway/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(triggerActionSpy).toHaveBeenCalledTimes(1);
    const [userMessage, formName, action] = triggerActionSpy.mock.calls[0]!;
    expect(userMessage).toBe("I've reviewed the low-confidence values.");
    expect(formName).toBeUndefined();
    expect(action).toMatchObject({
      type: "pending_extractions_acknowledged",
      params: {
        acknowledged: expect.arrayContaining(["description", "marketing.notes"]),
      },
    });
  });

  it("acknowledgement toggles back off on second click", () => {
    render(<Component props={{ extractions: [low("description")] }} renderNode={renderNode} />);
    const ackBtn = screen.getByRole("button", { name: /use description anyway/i });
    fireEvent.click(ackBtn);
    expect(screen.getByRole("button", { name: /unacknowledge description/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /unacknowledge description/i }));
    // Continue button is disabled again.
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("re-syncs acknowledged state when extractions prop changes", () => {
    const { rerender } = render(
      <Component props={{ extractions: [low("a")] }} renderNode={renderNode} />
    );
    fireEvent.click(screen.getByRole("button", { name: /use a anyway/i }));
    expect(screen.getByRole("button", { name: /continue/i })).toBeEnabled();

    // Refined extractions arrive — acknowledged set should reset.
    rerender(<Component props={{ extractions: [low("b")] }} renderNode={renderNode} />);
    expect(screen.queryByText("a")).not.toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
    // Submit disabled until the new row is acknowledged.
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("renders the acknowledged-count badge", () => {
    render(
      <Component props={{ extractions: [low("a"), low("b"), low("c")] }} renderNode={renderNode} />
    );
    const badge = screen.getByLabelText(/0 of 3 acknowledged/i);
    expect(badge).toHaveTextContent("0/3");
    fireEvent.click(screen.getByRole("button", { name: /use a anyway/i }));
    expect(screen.getByLabelText(/1 of 3 acknowledged/i)).toHaveTextContent("1/3");
  });

  it("respects custom acknowledgeLabel + acknowledgeAction", () => {
    render(
      <Component
        props={{
          extractions: [low("description")],
          acknowledgeLabel: "Apply LLM values",
          acknowledgeAction: "Apply the 1 low-confidence value.",
        }}
        renderNode={renderNode}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /use description anyway/i }));
    const submit = screen.getByRole("button", { name: /apply llm values/i });
    expect(submit).toBeInTheDocument();
    fireEvent.click(submit);
    expect(triggerActionSpy.mock.calls[0]?.[0]).toBe("Apply the 1 low-confidence value.");
  });

  it("renders non-string values (objects, null) through JSON.stringify fallback", () => {
    render(
      <Component
        props={{
          extractions: [low("structured", 0.5, { en: "Coffee Loyalty" }), low("absent", 0.5, null)],
        }}
        renderNode={renderNode}
      />
    );
    // The whole list section is bounded — scope queries inside it.
    const section = screen.getByLabelText("Low-confidence extractions");
    expect(within(section).getByText(/Coffee Loyalty/)).toBeInTheDocument();
    expect(within(section).getByText(/\(empty\)/)).toBeInTheDocument();
  });
});
