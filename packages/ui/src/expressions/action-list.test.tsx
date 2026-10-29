import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ActionList } from "./action-list";
import { ExpressionContextProvider } from "./expression-context";
import type { ExpressionAction } from "./types";

const { resolve } = vi.hoisted(() => ({
  resolve: {
    programName: () => undefined,
    offerName: () => undefined,
    badgeName: () => undefined,
    tierName: () => undefined,
    targetName: () => undefined,
    eventRuleName: () => undefined,
    audienceName: () => undefined,
    fieldName: () => undefined,
  },
}));

vi.mock("./action-summary-lookups", async (importOriginal) => ({
  ...(await importOriginal()),
  useActionSummaryLookups: () => resolve,
}));

// Radix Popover (PropertyPicker, sentence mode) relies on pointer-capture +
// scrollIntoView, which jsdom lacks.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

const actions: ExpressionAction[] = [
  {
    issueProgramCurrency: { defaultResult: 10, isFixedAmount: true, programCurrencyCode: "POINTS" },
  },
  { issueCustomerCoupon: { couponCode: "SAVE10" } },
];

function ControlledList({ initialActions }: { initialActions: ExpressionAction[] }) {
  const [currentActions, setCurrentActions] = useState(initialActions);
  return <ActionList actions={currentActions} onChange={setCurrentActions} />;
}

function renderList(node: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
}

describe("ActionList", () => {
  it("keeps only one action row expanded", async () => {
    const user = userEvent.setup();
    renderList(<ActionList actions={actions} onChange={vi.fn()} />);

    const expandButtons = screen.getAllByRole("button", { name: /expand action/i });
    await user.click(expandButtons[0]!);
    expect(expandButtons[0]).toHaveAttribute("aria-expanded", "true");

    await user.click(expandButtons[1]!);
    expect(expandButtons[0]).toHaveAttribute("aria-expanded", "false");
    expect(expandButtons[1]).toHaveAttribute("aria-expanded", "true");
  });

  it("auto-expands a newly added action", async () => {
    const user = userEvent.setup();
    renderList(<ControlledList initialActions={[]} />);

    await user.click(screen.getByRole("button", { name: "Add action" }));
    await user.click(screen.getByText("Issue Coupon"));

    expect(screen.getByText("Issue Coupon")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse action 1" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("fixes the expanded index when an earlier row is removed", async () => {
    const user = userEvent.setup();
    renderList(<ControlledList initialActions={actions} />);

    await user.click(screen.getByRole("button", { name: "Expand action 2" }));
    await user.click(screen.getByRole("button", { name: "Remove action 1" }));

    expect(screen.getByRole("button", { name: "Collapse action 1" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("removes the intended action", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderList(<ActionList actions={actions} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Remove action 2" }));
    expect(onChange).toHaveBeenCalledWith([actions[0]]);
  });

  it("preserves a later row's component identity when an earlier row is removed (adversarial review finding)", async () => {
    const user = userEvent.setup();
    const threeActions: ExpressionAction[] = [
      ...actions,
      { issueCustomerCoupon: { couponCode: "SAVE20" } },
    ];
    renderList(<ControlledList initialActions={threeActions} />);

    // Capture the third row's Remove button DOM node before the shift. With
    // index-based keys, removing row 1 would unmount this node entirely (no
    // key=2 exists after the shrink) and relabel a *different*, reused node
    // (formerly row 2's) as "Remove action 2" — silently carrying over any
    // local state (e.g. PathOrValueField's field/value mode) that node had
    // mounted for the wrong underlying action.
    const thirdRowRemoveButton = screen.getByRole("button", { name: "Remove action 3" });

    await user.click(screen.getByRole("button", { name: "Remove action 1" }));

    const shiftedRemoveButton = screen.getByRole("button", { name: "Remove action 2" });
    expect(shiftedRemoveButton).toBe(thirdRowRemoveButton);
  });
});

describe('ActionList — presentation="sentence" (adversarial review finding)', () => {
  // ExpressionModal → ExpressionBuilder is the only production surface, and it
  // always renders with presentation="sentence" — but no automated test had
  // ever exercised that this actually reaches the action components, only
  // Storybook. A regression where "sentence" silently fails to propagate
  // (e.g. an amount field rendering the card-mode JsonPathBrowser instead of
  // the sentence-mode PropertyPicker field pill) would ship undetected.
  it('propagates presentation="sentence" down to the amount field, rendering PropertyPicker\'s field pill instead of the card-mode breadcrumb+browse button', async () => {
    const user = userEvent.setup();
    const sentenceActions: ExpressionAction[] = [
      {
        issueProgramCurrency: {
          isFixedAmount: false,
          defaultResult: 0,
          path: "$.eventData.total",
          programCurrencyCode: "POINTS",
        },
      },
    ];

    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <ExpressionContextProvider mode="event" dataModelCode="ORDER_PLACED">
          <ActionList actions={sentenceActions} onChange={vi.fn()} presentation="sentence" />
        </ExpressionContextProvider>
      </QueryClientProvider>
    );

    await user.click(screen.getByRole("button", { name: "Expand action 1" }));

    // Sentence mode: PropertyPicker's field-pill trigger, not the card-mode
    // breadcrumb button + "Edit path"/"Browse schema fields" pencil-and-tree.
    expect(
      screen.getByRole("button", { name: /select a field|click to change/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Browse schema fields" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit path manually" })).not.toBeInTheDocument();
  });
});
