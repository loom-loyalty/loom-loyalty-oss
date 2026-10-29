import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ExpressionContextProvider } from "../expression-context";
import type { EqualsExpression } from "../types";
import { ComparisonSentence } from "./comparison-sentence";
import { EqualityExpressionComponent } from "./equality-expression";

const equalsData: EqualsExpression["equals"] = {
  path: "$.eventData.channel",
  value: "web",
  extractValueFromPath: false,
  defaultResult: false,
};

describe("MissingFieldAdvanced — engine default under Advanced (#1033)", () => {
  it("keeps the missing-field option collapsed under Advanced until opened", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ExpressionContextProvider mode="event">
        <EqualityExpressionComponent value={equalsData} onChange={onChange} mode="edit" />
      </ExpressionContextProvider>
    );

    expect(screen.queryByText("Default result if path not found")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("switch", { name: "Match when this field is missing" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Advanced" }));
    await user.click(screen.getByRole("switch", { name: "Match when this field is missing" }));

    expect(onChange).toHaveBeenLastCalledWith({ ...equalsData, defaultResult: true });
  });

  it("opens on mount when the condition already matches missing fields", () => {
    render(
      <ExpressionContextProvider mode="event">
        <EqualityExpressionComponent
          value={{ ...equalsData, defaultResult: true }}
          onChange={vi.fn()}
          mode="edit"
        />
      </ExpressionContextProvider>
    );

    expect(screen.getByRole("switch", { name: "Match when this field is missing" })).toBeChecked();
  });

  it("renders nothing for audience segments, whose SQL compiler ignores defaultResult", () => {
    render(
      <ExpressionContextProvider mode="customer">
        <EqualityExpressionComponent value={equalsData} onChange={vi.fn()} mode="edit" />
      </ExpressionContextProvider>
    );

    expect(screen.queryByRole("button", { name: "Advanced" })).not.toBeInTheDocument();
  });

  it("is reachable from the sentence-mode row for event rules", async () => {
    const user = userEvent.setup();
    const onDataChange = vi.fn();
    render(
      <ExpressionContextProvider mode="event">
        <ComparisonSentence
          type="equals"
          data={equalsData}
          onDataChange={onDataChange}
          onTypeChange={vi.fn()}
        />
      </ExpressionContextProvider>
    );

    await user.click(screen.getByRole("button", { name: "Advanced" }));
    await user.click(screen.getByRole("switch", { name: "Match when this field is missing" }));

    expect(onDataChange).toHaveBeenLastCalledWith({ ...equalsData, defaultResult: true });
  });
});

describe("ComparisonSentence — anniversary (birthday) shape", () => {
  it("reads as 'is today' with no operator or raw true value to edit", () => {
    render(
      <ExpressionContextProvider mode="customer">
        <ComparisonSentence
          type="equals"
          data={{
            path: "$.birthDate",
            value: true,
            extractValueFromPath: false,
            defaultResult: false,
            preOperation: { matchesCurrentDate: { timeZone: "ORGANIZATION" } },
          }}
          onDataChange={vi.fn()}
          onTypeChange={vi.fn()}
        />
      </ExpressionContextProvider>
    );

    expect(screen.getByText("is today (month and day)")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Condition" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Value")).not.toBeInTheDocument();
  });
});
