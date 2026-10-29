/**
 * RecordActivityCheckPanel behavior suite (U7, panel half).
 *
 * The "no predicted rewards" assertion is deliberate and load-bearing: no dry
 * run exists, so any number here would be a guess an agent might repeat to a
 * customer.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecordActivityCheckPanel } from "../record-activity/record-activity-check-panel.js";

type Props = Parameters<typeof RecordActivityCheckPanel>[0];

function renderPanel(overrides: Partial<Props> = {}) {
  const props: Props = {
    activityName: "Hotel stay",
    customerName: "Ada Lovelace",
    date: "14 August 2026",
    details: [
      { name: "nights", label: "Nights", value: "2" },
      { name: "property", label: "Property", value: "Grand Central" },
    ],
    ...overrides,
  };
  return render(<RecordActivityCheckPanel {...props} />);
}

describe("RecordActivityCheckPanel", () => {
  it("shows the activity, customer, date, and detail values", () => {
    // Covers AE6, first half.
    renderPanel();

    expect(screen.getByText("Hotel stay")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("14 August 2026")).toBeInTheDocument();
    expect(screen.getByText("Nights")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Property")).toBeInTheDocument();
    expect(screen.getByText("Grand Central")).toBeInTheDocument();
  });

  it("shows no predicted points, currency, or tier", () => {
    // Covers AE6, second half. The panel restates; it never forecasts.
    renderPanel();

    const text = (screen.getByRole("region", { hidden: true }).textContent ?? "").toLowerCase();
    for (const forbidden of [
      "points",
      "currency",
      "tier",
      "will earn",
      "will receive",
      "estimated",
    ]) {
      expect(text, `panel must not predict "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it("renders an unset optional detail as unset rather than omitting it", () => {
    renderPanel({
      details: [
        { name: "nights", label: "Nights", value: "2" },
        { name: "note", label: "Note", value: null },
      ],
    });

    expect(screen.getByText("Note")).toBeInTheDocument();
    expect(screen.getByText("Not set")).toBeInTheDocument();
  });

  it("treats an empty string as unset", () => {
    renderPanel({ details: [{ name: "note", label: "Note", value: "" }] });

    expect(screen.getByText("Not set")).toBeInTheDocument();
  });

  it("reflects an edited detail without a resubmit", () => {
    const { rerender } = renderPanel();

    expect(screen.getByText("2")).toBeInTheDocument();

    rerender(
      <RecordActivityCheckPanel
        activityName="Hotel stay"
        customerName="Ada Lovelace"
        date="14 August 2026"
        details={[
          { name: "nights", label: "Nights", value: "5" },
          { name: "property", label: "Property", value: "Grand Central" },
        ]}
      />
    );

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.queryByText("2")).not.toBeInTheDocument();
  });

  it("names the earlier record in an advisory warning", () => {
    // Covers AE5, panel half. The apply control lives in the modal and is
    // never disabled by this warning.
    renderPanel({
      earlierRecord: { activityName: "Hotel stay", recordedOn: "14 August 2026" },
    });

    const warning = screen.getByRole("status");
    expect(warning).toHaveTextContent("Hotel stay");
    expect(warning).toHaveTextContent("14 August 2026");
    expect(warning).toHaveTextContent("You can still apply this one.");
  });

  it("shows no warning when there is no earlier record", () => {
    renderPanel();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("prompts for an activity before restating anything", () => {
    renderPanel({ activityName: null });

    expect(
      screen.getByText("Choose an activity and this panel will show exactly what gets recorded.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
  });

  it("renders a heading that names the panel's purpose", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: "Check before you apply" })).toBeInTheDocument();
  });
});
