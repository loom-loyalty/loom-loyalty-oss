import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Stub the tier data hook so <TierField> renders without a QueryClient/network.
vi.mock("../../forms/tier-field/use-tier-field.js", () => ({
  useTierField: () => ({
    options: [],
    optionsAll: [],
    isLoading: false,
    error: null,
    searchValue: "",
    setSearchValue: () => {},
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: () => {},
    findTier: () => undefined,
  }),
}));

import { ExpressionContextProvider } from "../expression-context";
import type { CurrentTierExpression } from "../types";
import { CurrentTierExpressionComponent } from "./current-tier-expression";

type CurrentTierData = CurrentTierExpression["currentTier"];

// A value that already carries the segment-only fields, as if loaded from a
// rule that was authored on the customer surface.
const valueWithSegmentFields: CurrentTierData = {
  tierCode: "GOLD",
  validateLifetimeTier: false,
  validateTrialTier: false,
  revalidateTier: false,
  minRank: 3,
  requireActive: true,
};

function renderOnSurface(
  surface: "event" | "customer",
  value: CurrentTierData,
  onChange: (v: CurrentTierData) => void
): void {
  render(
    <ExpressionContextProvider mode={surface}>
      <CurrentTierExpressionComponent value={value} onChange={onChange} mode="edit" />
    </ExpressionContextProvider>
  );
}

describe("CurrentTierExpressionComponent — segment-only field gating (F8)", () => {
  it("strips a loaded minRank/requireActive on mount on the event surface", () => {
    const onChange = vi.fn();
    renderOnSurface("event", valueWithSegmentFields, onChange);

    expect(onChange).toHaveBeenCalled();
    const emitted = onChange.mock.calls[0]![0] as Record<string, unknown>;
    expect(emitted).not.toHaveProperty("minRank");
    expect(emitted).not.toHaveProperty("requireActive");
    // The event-surface fields are preserved.
    expect(emitted).toMatchObject({ tierCode: "GOLD" });
  });

  it("never emits minRank/requireActive from an edit on the event surface", () => {
    const onChange = vi.fn();
    renderOnSurface("event", valueWithSegmentFields, onChange);

    // Toggling a validate switch is an edit; the segment-only fields must not
    // ride along in any emitted value.
    fireEvent.click(screen.getAllByRole("switch")[0]!);

    expect(onChange.mock.calls.length).toBeGreaterThan(0);
    for (const call of onChange.mock.calls) {
      expect(call[0]).not.toHaveProperty("minRank");
      expect(call[0]).not.toHaveProperty("requireActive");
    }
  });

  it("preserves minRank/requireActive on the customer surface", () => {
    const onChange = vi.fn();
    renderOnSurface("customer", valueWithSegmentFields, onChange);

    // No mount strip when the fields are valid for the surface.
    expect(onChange).not.toHaveBeenCalled();
    // The segment-only controls render and are labeled.
    expect(screen.getByLabelText(/minimum rank/i)).toHaveValue(3);

    // Editing keeps the segment-only fields intact.
    fireEvent.click(screen.getAllByRole("switch")[0]!);
    expect(onChange.mock.calls[0]![0]).toMatchObject({ minRank: 3, requireActive: true });
  });
});
