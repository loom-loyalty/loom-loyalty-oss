import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ResultVisualization } from "./result-visualization";

// Recharts measures its container, which jsdom reports as 0×0 and then renders
// nothing. These assertions therefore cover the switcher, the fallbacks, and the
// accessible table — not the SVG marks, which are exercised in Storybook.

const TIER_COLUMNS = [
  { name: "tier_name", type: "String" },
  { name: "customer_count", type: "UInt64" },
];
const TIER_ROWS = [
  { tier_name: "Gold", customer_count: 120 },
  { tier_name: "Silver", customer_count: 340 },
  { tier_name: "Bronze", customer_count: 890 },
];

describe("ResultVisualization", () => {
  it("auto-selects the pie for a small category breakdown", () => {
    render(<ResultVisualization columns={TIER_COLUMNS} rows={TIER_ROWS} />);
    expect(screen.getByRole("radio", { name: "Show as pie" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("explains why it picked that view", () => {
    render(<ResultVisualization columns={TIER_COLUMNS} rows={TIER_ROWS} />);
    expect(screen.getByText(/parts of a whole/i)).toBeInTheDocument();
  });

  it("lets the user override the auto-selection", async () => {
    const user = userEvent.setup();
    render(<ResultVisualization columns={TIER_COLUMNS} rows={TIER_ROWS} />);

    await user.click(screen.getByRole("radio", { name: "Show as table" }));

    expect(screen.getByRole("radio", { name: "Show as table" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("re-runs auto-selection when a new result arrives", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ResultVisualization columns={TIER_COLUMNS} rows={TIER_ROWS} resultKey="query-a" />
    );

    await user.click(screen.getByRole("radio", { name: "Show as table" }));
    expect(screen.getByRole("radio", { name: "Show as table" })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    rerender(<ResultVisualization columns={TIER_COLUMNS} rows={TIER_ROWS} resultKey="query-b" />);

    // The override belonged to the previous result, not to the control.
    expect(screen.getByRole("radio", { name: "Show as pie" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("offers no pie for a result the inference judges unfit for one", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      offer_code: `OFFER_${String(i)}`,
      coupons: i + 1,
    }));
    render(
      <ResultVisualization
        columns={[
          { name: "offer_code", type: "String" },
          { name: "coupons", type: "UInt64" },
        ]}
        rows={rows}
      />
    );
    expect(screen.queryByRole("radio", { name: "Show as pie" })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Show as bar" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("hides the switcher entirely when only the table is honest", () => {
    render(
      <ResultVisualization
        columns={[
          { name: "customer_id", type: "String" },
          { name: "status", type: "String" },
        ]}
        rows={[{ customer_id: "a", status: "ACTIVE" }]}
      />
    );
    expect(screen.queryByRole("group", { name: "Result view" })).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("offers a measure picker only when there is more than one measure to draw", async () => {
    const user = userEvent.setup();
    render(
      <ResultVisualization
        columns={[
          { name: "offer_name", type: "String" },
          { name: "coupons_issued", type: "UInt64" },
          { name: "total_discount_value", type: "Float64" },
        ]}
        rows={[
          { offer_name: "Summer", coupons_issued: 10, total_discount_value: 250 },
          { offer_name: "Winter", coupons_issued: 4, total_discount_value: 90 },
        ]}
      />
    );

    expect(screen.getByRole("combobox", { name: "Measure" })).toBeInTheDocument();

    // Switching to the table drops the picker — a table shows every measure.
    await user.click(screen.getByRole("radio", { name: "Show as table" }));
    expect(screen.queryByRole("combobox", { name: "Measure" })).not.toBeInTheDocument();
  });

  it("keeps the rows reachable as text while a chart is shown", () => {
    render(<ResultVisualization columns={TIER_COLUMNS} rows={TIER_ROWS} />);
    const disclosure = screen.getByText(/all 3 rows as a table/i);
    expect(disclosure).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Gold")).toBeInTheDocument();
  });
});

describe("ResultVisualization controlled shape", () => {
  it("renders the view from a stored shape", () => {
    render(
      <ResultVisualization
        columns={TIER_COLUMNS}
        rows={TIER_ROWS}
        shape={{ version: 1, kind: "bar", dimension: "tier_name", measure: "customer_count" }}
      />
    );
    expect(screen.getByRole("radio", { name: "Show as bar" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("draws the stored measure and emits measure changes without switching locally", async () => {
    const user = userEvent.setup();
    const onShapeChange = vi.fn();
    render(
      <ResultVisualization
        columns={[
          { name: "offer_name", type: "String" },
          { name: "coupons_issued", type: "UInt64" },
          { name: "total_discount_value", type: "Float64" },
        ]}
        rows={[
          { offer_name: "Summer", coupons_issued: 10, total_discount_value: 250 },
          { offer_name: "Winter", coupons_issued: 4, total_discount_value: 90 },
        ]}
        shape={{
          version: 1,
          kind: "bar",
          dimension: "offer_name",
          measure: "total_discount_value",
        }}
        onShapeChange={onShapeChange}
      />
    );

    const picker = screen.getByRole("combobox", { name: "Measure" });
    expect(picker).toHaveTextContent("total_discount_value");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.click(picker);
    await user.click(screen.getByRole("option", { name: "coupons_issued" }));
    expect(onShapeChange).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "bar", measure: "coupons_issued" })
    );
    expect(screen.getByRole("combobox", { name: "Measure" })).toHaveTextContent(
      "total_discount_value"
    );
  });

  it("emits a new shape instead of switching locally", async () => {
    const user = userEvent.setup();
    const onShapeChange = vi.fn();
    render(
      <ResultVisualization
        columns={TIER_COLUMNS}
        rows={TIER_ROWS}
        shape={{ version: 1, kind: "bar", dimension: "tier_name", title: "Tiers" }}
        onShapeChange={onShapeChange}
      />
    );

    await user.click(screen.getByRole("radio", { name: "Show as table" }));

    expect(onShapeChange).toHaveBeenCalledWith(
      expect.objectContaining({ version: 1, kind: "table", title: "Tiers" })
    );
    // The parent did not update the shape, so the view stays as stored.
    expect(screen.getByRole("radio", { name: "Show as bar" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("shows an inline note when the stored shape no longer fits", () => {
    render(
      <ResultVisualization
        columns={TIER_COLUMNS}
        rows={TIER_ROWS}
        shape={{ version: 1, kind: "line", dimension: "period", series: "tier" }}
      />
    );
    const note = screen.getByRole("status");
    expect(note).toHaveTextContent(/saved chart no longer matches/i);
    expect(note).toHaveTextContent(/tier/);
    expect(screen.getByRole("radio", { name: "Show as pie" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("reports changes in uncontrolled mode while still switching locally", async () => {
    const user = userEvent.setup();
    const onShapeChange = vi.fn();
    render(
      <ResultVisualization columns={TIER_COLUMNS} rows={TIER_ROWS} onShapeChange={onShapeChange} />
    );
    await user.click(screen.getByRole("radio", { name: "Show as bar" }));
    expect(screen.getByRole("radio", { name: "Show as bar" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(onShapeChange).toHaveBeenCalledWith(expect.objectContaining({ kind: "bar" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
