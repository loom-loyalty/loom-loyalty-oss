import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

// Mock @openuidev/react-lang — needed because defineOpenUIComponent calls defineComponent at import time
const triggerAction = vi.fn();
vi.mock("@openuidev/react-lang", () => ({
  defineComponent: (config: Record<string, unknown>) => ({
    ...config,
    ref: z.any(),
  }),
  useTriggerAction: () => triggerAction,
}));

import { Alert } from "../components/feedback/alert";
import { Confirmation } from "../components/feedback/confirmation";
import {
  OPEN_DRAFT_IN_EDITOR_ACTION,
  RuleOrFlowDraft,
} from "../components/feedback/rule-or-flow-draft";
import { ValidationReport } from "../components/feedback/validation-report";

const renderNode = (value: unknown) => <span>{String(value)}</span>;

describe("Alert", () => {
  const Component = Alert.component;

  it("renders info alert with role=status", () => {
    render(
      <Component
        props={{ type: "info", title: "Heads up", message: "Info message" }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Heads up")).toBeInTheDocument();
    expect(screen.getByText("Info message")).toBeInTheDocument();
  });

  it("renders success alert with role=status", () => {
    render(<Component props={{ type: "success", title: "Done" }} renderNode={renderNode} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("renders warning alert with role=alert", () => {
    render(<Component props={{ type: "warning", title: "Warning" }} renderNode={renderNode} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders error alert with role=alert", () => {
    render(
      <Component props={{ type: "error", title: "Error occurred" }} renderNode={renderNode} />
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Error occurred")).toBeInTheDocument();
  });

  it("renders without message", () => {
    render(<Component props={{ type: "info", title: "Title only" }} renderNode={renderNode} />);
    expect(screen.getByText("Title only")).toBeInTheDocument();
  });

  it("hides icon from screen readers", () => {
    const { container } = render(
      <Component props={{ type: "info", title: "Test" }} renderNode={renderNode} />
    );
    const icon = container.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Confirmation", () => {
  const Component = Confirmation.component;

  it("renders title, message, and action buttons", () => {
    render(
      <Component
        props={{
          title: "Delete item?",
          message: "This cannot be undone.",
          confirmAction: "delete",
        }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByText("Delete item?")).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("renders custom button labels", () => {
    render(
      <Component
        props={{
          title: "Confirm",
          message: "Are you sure?",
          confirmAction: "proceed",
          confirmLabel: "Yes, proceed",
          cancelLabel: "No, go back",
        }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByRole("button", { name: "Yes, proceed" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No, go back" })).toBeInTheDocument();
  });
});

describe("ValidationReport", () => {
  const Component = ValidationReport.component;

  const passedScenarios = [
    { name: "Purchase earns points", result: "PASSED" as const },
    { name: "Signup bonus awarded", result: "PASSED" as const },
  ];

  const mixedScenarios = [
    { name: "Purchase earns points", result: "PASSED" as const },
    { name: "Tier upgrade", result: "FAILED" as const, message: "Expected GOLD, got SILVER" },
    { name: "Event processing", result: "INCONCLUSIVE" as const },
  ];

  it("renders all-passed report with status badge", () => {
    render(
      <Component
        props={{
          scenarios: passedScenarios,
          overallResult: "PASSED",
        }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByText("Validation Report")).toBeInTheDocument();
    expect(screen.getByText("Purchase earns points")).toBeInTheDocument();
    expect(screen.getByText("Signup bonus awarded")).toBeInTheDocument();
    expect(screen.getByText("Passed (2/2)")).toBeInTheDocument();
  });

  it("renders mixed results with failure details", () => {
    render(
      <Component
        props={{
          scenarios: mixedScenarios,
          overallResult: "FAILED",
          fixAction: "fix_issues",
          proceedAction: "proceed_anyway",
        }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByText("Expected GOLD, got SILVER")).toBeInTheDocument();
    expect(screen.getByText("Failed (1/3)")).toBeInTheDocument();
  });

  it("shows footer actions when overallResult is not PASSED", () => {
    render(
      <Component
        props={{
          scenarios: mixedScenarios,
          overallResult: "FAILED",
          fixAction: "fix_issues",
          proceedAction: "proceed_anyway",
        }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByRole("button", { name: "Fix Issues" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Proceed Anyway" })).toBeInTheDocument();
  });

  it("hides footer when overallResult is PASSED", () => {
    render(
      <Component
        props={{
          scenarios: passedScenarios,
          overallResult: "PASSED",
          fixAction: "fix_issues",
        }}
        renderNode={renderNode}
      />
    );
    expect(screen.queryByRole("button", { name: "Fix Issues" })).not.toBeInTheDocument();
  });

  it("formats durationMs correctly", () => {
    render(
      <Component
        props={{
          scenarios: passedScenarios,
          overallResult: "PASSED",
          durationMs: 3200,
        }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByText("Completed in 3.2s")).toBeInTheDocument();
  });

  it("renders INCONCLUSIVE with correct label", () => {
    render(
      <Component
        props={{
          scenarios: [{ name: "Timeout test", result: "INCONCLUSIVE" }],
          overallResult: "INCONCLUSIVE",
        }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByText("Inconclusive (0/1)")).toBeInTheDocument();
  });

  it("has accessible scenario list", () => {
    render(
      <Component
        props={{ scenarios: passedScenarios, overallResult: "PASSED" }}
        renderNode={renderNode}
      />
    );
    expect(screen.getByRole("list", { name: "Validation scenarios" })).toBeInTheDocument();
  });
});

describe("RuleOrFlowDraft", () => {
  const Component = RuleOrFlowDraft.component;
  const draft = {
    kind: "flow" as const,
    name: "Welcome series",
    code: "welcome-series",
    reason: "It waits 7 days before the bonus, so it's a flow.",
    summary: ["When a customer signs up", "Issue a welcome offer", "Wait 7 days"],
    needs: ["Pick the welcome offer"],
    flow: { triggerEventTypeCode: "signup", steps: [{ stepKey: "offer" }] },
  };

  it("shows the kind, name, code, reason, steps and what's still needed", () => {
    render(<Component props={{ draft }} renderNode={renderNode} />);
    expect(screen.getByText("Flow draft")).toBeInTheDocument();
    expect(screen.getByText("Welcome series")).toBeInTheDocument();
    expect(screen.getByText("welcome-series")).toBeInTheDocument();
    expect(screen.getByText(draft.reason)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      ...draft.summary,
      "Pick the welcome offer",
    ]);
  });

  it("opens the editor with the whole draft, or asks for the other kind", () => {
    triggerAction.mockClear();
    render(<Component props={{ draft }} renderNode={renderNode} />);

    screen.getByRole("button", { name: "Open in flow editor" }).click();
    expect(triggerAction).toHaveBeenLastCalledWith("Open in flow editor", undefined, {
      type: OPEN_DRAFT_IN_EDITOR_ACTION,
      params: { draft },
    });

    screen.getByRole("button", { name: "Make it an event rule" }).click();
    expect(triggerAction).toHaveBeenLastCalledWith("Make it an event rule instead");
    expect(screen.queryByRole("button", { name: "Draft the reward rule" })).toBeNull();
  });

  it("lists the targets it will create and offers to draft the reward rule", () => {
    triggerAction.mockClear();
    const counting = {
      kind: "event-rule" as const,
      name: "Count coffees",
      code: "count-coffees",
      reason: "One event, one action.",
      summary: ["Add 1 to Coffee card"],
      targets: [
        {
          code: "coffee-card",
          name: "Coffee card",
          type: "COUNTER" as const,
          targetValue: 5,
          reregisterOnAchievement: true,
        },
      ],
      rule: { eventTypeCode: "purchase" },
    };
    render(<Component props={{ draft: counting }} renderNode={renderNode} />);

    expect(screen.getByText("Creates these targets when you save:")).toBeInTheDocument();
    expect(
      screen.getAllByRole("listitem").some((li) => li.textContent?.includes("goal 5, starts again"))
    ).toBe(true);
    screen.getByRole("button", { name: "Draft the reward rule" }).click();
    expect(triggerAction).toHaveBeenLastCalledWith(
      "Draft the reward rule for reaching Coffee card (coffee-card)"
    );
  });
});
