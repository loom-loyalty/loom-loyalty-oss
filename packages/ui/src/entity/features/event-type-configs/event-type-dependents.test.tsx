import type { EventRule } from "@loom-loyalty/sdk";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EventTypeDependents } from "./event-type-dependents";

function rule(overrides: Partial<EventRule>): EventRule {
  return {
    eventRuleId: "er_1",
    code: "RULE_1",
    name: "Rule One",
    eventTypeCode: "purchase",
    category: "ORGANIZATION_DEFINED",
    programIds: [],
    ...overrides,
  } as EventRule;
}

describe("EventTypeDependents — Event Rules (R4)", () => {
  it("shows all 3 dependent rules", () => {
    render(
      <EventTypeDependents
        rules={[
          rule({ eventRuleId: "er_1", name: "Rule One" }),
          rule({ eventRuleId: "er_2", name: "Rule Two" }),
          rule({ eventRuleId: "er_3", name: "Rule Three" }),
        ]}
      />
    );
    expect(screen.getAllByTestId("event-type-dependent-rule")).toHaveLength(3);
    expect(screen.getByText("Rule One")).toBeInTheDocument();
    expect(screen.getByText("Rule Two")).toBeInTheDocument();
    expect(screen.getByText("Rule Three")).toBeInTheDocument();
  });

  it("shows an explicit empty state distinguishable from the flows not-available state", () => {
    render(<EventTypeDependents rules={[]} />);
    expect(screen.getByText("No rules reference this event type yet.")).toBeInTheDocument();
    expect(screen.getByText(/Not available yet/)).toBeInTheDocument();
  });

  it("shows an inline error with retry when the rules query fails", () => {
    const onRetryRules = vi.fn();
    render(<EventTypeDependents rules={[]} rulesError onRetryRules={onRetryRules} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load rules that reference this event type."
    );
    screen.getByText("Retry").click();
    expect(onRetryRules).toHaveBeenCalled();
  });

  it("qualifies a truncated rules list", () => {
    render(<EventTypeDependents rules={[rule({})]} rulesCapped />);
    expect(screen.getByText(/There may be more/)).toBeInTheDocument();
  });
});

describe("EventTypeDependents — Flows (R5, AE5)", () => {
  it("always shows the not-yet-available state, never a silent empty list", () => {
    render(<EventTypeDependents rules={[rule({})]} />);
    expect(screen.getByText(/Not available yet/)).toBeInTheDocument();
  });
});
