import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FraudCaseCard } from "./fraud-case-card.js";
import { FraudIndicator } from "./fraud-indicator.js";

describe("FraudIndicator", () => {
  it("shows the line and opens the review", () => {
    const onReview = vi.fn();
    render(
      <FraudIndicator tone="blocked" label="Redemptions blocked by a rule" onReview={onReview} />
    );
    expect(screen.getByRole("status")).toHaveTextContent("Redemptions blocked by a rule");
    fireEvent.click(screen.getByRole("button", { name: "Review fraud" }));
    expect(onReview).toHaveBeenCalledOnce();
  });

  it("leaves out Review without a handler", () => {
    render(<FraudIndicator tone="warning" label="Fraud review · 1 open case" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("FraudCaseCard", () => {
  it("shows status, score, reasons and decision buttons", () => {
    const onConfirm = vi.fn();
    render(
      <FraudCaseCard
        status="OPEN"
        scoreLabel="75%"
        reasons={[
          { code: "EMAIL_CHANGED", text: "Email changed 4 min before redemption" },
          { code: "RULE_ATO_1", text: "Rule ATO-1" },
        ]}
        decisionCount={1}
        onClear={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("Email changed 4 min before redemption")).toBeInTheDocument();
    expect(screen.getByText("1 decision")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm fraud" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("shows only the buttons it has handlers for, and disables decisions while pending", () => {
    render(<FraudCaseCard status="CONFIRMED" scoreLabel="60%" onClear={vi.fn()} pending />);
    expect(screen.getByText("Confirmed fraud")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear it" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Confirm fraud" })).toBeNull();
    expect(screen.queryByRole("button", { name: "View decisions" })).toBeNull();
  });

  it("marks a Logging-mode case that would have blocked", () => {
    render(<FraudCaseCard status="OPEN" scoreLabel="90%" wouldHaveBlocked />);
    expect(screen.getByText("Would have blocked")).toBeInTheDocument();
  });
});
