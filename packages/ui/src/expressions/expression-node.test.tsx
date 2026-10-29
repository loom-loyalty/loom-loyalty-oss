import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ExpressionContextProvider, type DataModelLike } from "./expression-context";
import { ExpressionNode } from "./expression-node";
import type { Expression, ExpressionNodeProps } from "./types";

// PropertyPicker (rendered by the sentence-mode field pill) reports live path
// validation up through `ExpressionModal`'s aggregation hook (U1's contract).
// These are leaf-level U2 tests, so stub it rather than mounting a full modal.
const reportPathError = vi.fn();
const reportFieldName = vi.fn();
vi.mock("./expression-modal.js", () => ({
  useExpressionPathValidation: () => ({ reportPathError, reportFieldName }),
}));

// Radix Select/Popover rely on pointer-capture + scrollIntoView, which jsdom lacks.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

const EMPTY_MODEL: DataModelLike = { elements: [] };
const fetchDataModel = vi.fn(() => Promise.resolve(EMPTY_MODEL));

function renderNode(expression: Expression, props?: Partial<ExpressionNodeProps>) {
  const onChange = vi.fn();
  const utils = render(
    <ExpressionContextProvider
      dataModelCode="ORDER_PLACED"
      mode="event"
      fetchDataModel={fetchDataModel}
    >
      <ExpressionNode
        expression={expression}
        onChange={onChange}
        depth={1}
        presentation="sentence"
        {...props}
      />
    </ExpressionContextProvider>
  );
  return { onChange, ...utils };
}

describe("ExpressionNode — ComparisonSentence happy path (AE1, R4, R6)", () => {
  it("renders a greaterThan leaf as a sentence with the field pill, operator, and value visible", () => {
    const expr: Expression = {
      greaterThan: { path: "$.eventData.order.total", value: 100, extractValueFromPath: false },
    };
    renderNode(expr);

    // The fixture's schema is empty, so the path never resolves — the pill
    // correctly falls back to the neutral placeholder rather than ever
    // showing the raw path (property-picker.test.tsx covers the resolved
    // friendly-breadcrumb case in depth).
    expect(screen.getByRole("button", { name: "Select a field" })).toBeInTheDocument();
    expect(screen.getByText("is")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveTextContent("more than");
    expect(screen.getByRole("spinbutton", { name: "Value" })).toHaveValue(100);
  });

  it("edits the value and writes the AST via the existing handleDataChange (byte-for-byte, KTD6)", () => {
    const expr: Expression = {
      greaterThan: { path: "$.eventData.order.total", value: 100, extractValueFromPath: false },
    };
    const { onChange } = renderNode(expr);

    fireEvent.change(screen.getByRole("spinbutton", { name: "Value" }), {
      target: { value: "200" },
    });

    expect(onChange).toHaveBeenLastCalledWith({
      greaterThan: { path: "$.eventData.order.total", value: 200, extractValueFromPath: false },
    });
  });

  it("displays a string-shaped numeric value instead of blanking it (Codex review F7 — AI/JSON-sourced string numerics were silently hidden)", () => {
    const expr: Expression = {
      greaterThan: {
        path: "$.eventData.order.total",
        value: "100" as unknown as number,
        extractValueFromPath: false,
      },
    };
    renderNode(expr);

    expect(screen.getByRole("spinbutton", { name: "Value" })).toHaveValue(100);
  });

  it("still blanks a genuinely non-numeric value", () => {
    const expr: Expression = {
      greaterThan: {
        path: "$.eventData.order.total",
        value: "not-a-number" as unknown as number,
        extractValueFromPath: false,
      },
    };
    renderNode(expr);

    expect(screen.getByRole("spinbutton", { name: "Value" })).toHaveValue(null);
  });

  it("edits the field via the Edit-path escape hatch, preserving the operator and value", async () => {
    const user = userEvent.setup();
    const expr: Expression = {
      greaterThan: { path: "$.eventData.order.total", value: 100, extractValueFromPath: false },
    };
    const { onChange } = renderNode(expr);

    await user.click(screen.getByRole("button", { name: "Select a field" }));
    await user.click(screen.getByRole("button", { name: "Edit path" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Edit path manually" }), {
      target: { value: "$.eventData.order.subtotal" },
    });

    expect(onChange).toHaveBeenLastCalledWith({
      greaterThan: {
        path: "$.eventData.order.subtotal",
        value: 100,
        extractValueFromPath: false,
      },
    });
  });
});

describe("ExpressionNode — operator switching via the transition function (KTD10)", () => {
  it("switches greaterThan -> lessThanEquals, changing the AST's top-level key and preserving path/value", async () => {
    const user = userEvent.setup();
    const expr: Expression = {
      greaterThan: { path: "$.eventData.order.total", value: 100, extractValueFromPath: false },
    };
    const { onChange } = renderNode(expr);

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "at most" }));

    expect(onChange).toHaveBeenCalledWith({
      lessThanEquals: {
        path: "$.eventData.order.total",
        value: 100,
        extractValueFromPath: false,
      },
    });
  });

  it("preserves attached reward actions across an operator switch (adversarial review finding)", async () => {
    const user = userEvent.setup();
    const expr: Expression = {
      greaterThan: {
        path: "$.eventData.order.total",
        value: 100,
        extractValueFromPath: false,
        actions: [{ issueProgramCurrency: { amount: 500, programCurrencyCode: "POINTS" } }],
      },
    } as unknown as Expression;
    const onChange = vi.fn();
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ExpressionContextProvider
          dataModelCode="ORDER_PLACED"
          mode="event"
          fetchDataModel={fetchDataModel}
        >
          <ExpressionNode
            expression={expr}
            onChange={onChange}
            depth={1}
            presentation="sentence"
            showActions
          />
        </ExpressionContextProvider>
      </QueryClientProvider>
    );

    const operatorCombobox = screen
      .getAllByRole("combobox")
      .find((el) => el.textContent === "more than")!;
    await user.click(operatorCombobox);
    await user.click(await screen.findByRole("option", { name: "at most" }));

    expect(onChange).toHaveBeenCalledWith({
      lessThanEquals: {
        path: "$.eventData.order.total",
        value: 100,
        extractValueFromPath: false,
        actions: [{ issueProgramCurrency: { amount: 500, programCurrencyCode: "POINTS" } }],
      },
    });
  });

  it("scopes the operator control to comparison-family types only, never a specialized/composite type (fix #12)", async () => {
    const user = userEvent.setup();
    const expr: Expression = {
      greaterThan: { path: "$.eventData.order.total", value: 100, extractValueFromPath: false },
    };
    renderNode(expr);

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByRole("option", { name: "between" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "is one of" })).toBeInTheDocument();
    // Specialized/composite types were never in this list to begin with — the
    // sentence-mode operator control is built directly from
    // COMPARISON_FAMILY_TYPES, so there is no query path that could surface
    // them (fix #12 domain guard is structural, not just excluded post hoc).
    expect(screen.queryByRole("option", { name: /has badge/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /always true/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /event count/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /^and$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /^or$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /^not$/i })).not.toBeInTheDocument();
  });
});

describe("ExpressionNode — sentence-mode leaf dispatch (AE2, R5, R6)", () => {
  it("comparison-family types dispatch to ComparisonSentence", () => {
    const expr: Expression = {
      greaterThan: { path: "$.eventData.order.total", value: 100, extractValueFromPath: false },
    };
    renderNode(expr);

    expect(screen.getByRole("combobox")).toHaveTextContent("more than");
  });

  it("specialized types dispatch through the wired PropertyPicker (Unit 3), still editable via its manual escape hatch", async () => {
    const user = userEvent.setup();
    const expr: Expression = { exists: { path: "$.eventData.order.total" } };
    const { onChange } = renderNode(expr);

    // No comparison operator control for a specialized type...
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    // ...but the type-name badge and label still render, and the field itself
    // now goes through the same PropertyPicker as the comparison-family types
    // — the old breadcrumb/pencil card fallback (presentation was previously
    // dropped for these 5 operators) is gone.
    expect(screen.getByText("Exists")).toBeInTheDocument();
    expect(screen.getByText("Path to check")).toBeInTheDocument();
    expect(screen.queryByLabelText(/JSON path:.*Click to edit manually/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select a field" }));
    await user.click(screen.getByRole("button", { name: "Edit path" }));
    const manualInput = screen.getByRole("textbox", { name: /edit path manually/i });
    await user.clear(manualInput);
    await user.type(manualInput, "$.eventData.order.subtotal");

    expect(onChange).toHaveBeenLastCalledWith({
      exists: { path: "$.eventData.order.subtotal" },
    });
  });

  it("the true type (no fields) still renders its existing static fallback content", () => {
    const expr: Expression = { true: {} };
    const { onChange } = renderNode(expr);

    expect(screen.getByText(/always evaluates to true/i)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("ExpressionNode — Unit 3: previously-unwired operators get live path validation (R2b)", () => {
  afterEach(() => {
    reportPathError.mockClear();
  });

  const RESOLVABLE_MODEL: DataModelLike = {
    elements: [{ outputAttribute: "total", name: "Total", typeReference: "NUMBER" }],
  };
  const fetchResolvable = vi.fn(() => Promise.resolve(RESOLVABLE_MODEL));

  function renderResolvable(expression: Expression) {
    return render(
      <ExpressionContextProvider
        dataModelCode="ORDER_PLACED"
        mode="event"
        fetchDataModel={fetchResolvable}
      >
        <ExpressionNode
          expression={expression}
          onChange={vi.fn()}
          depth={1}
          presentation="sentence"
        />
      </ExpressionContextProvider>
    );
  }

  // eventSum also renders EventTypeField, which reads react-query — the other
  // 4 operators under test here don't need this provider.
  function renderEventSum(expression: Expression, model: DataModelLike = EMPTY_MODEL) {
    const queryClient = new QueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <ExpressionContextProvider
          dataModelCode="ORDER_PLACED"
          mode="event"
          fetchDataModel={() => Promise.resolve(model)}
        >
          <ExpressionNode
            expression={expression}
            onChange={vi.fn()}
            depth={1}
            presentation="sentence"
          />
        </ExpressionContextProvider>
      </QueryClientProvider>
    );
  }

  it("notExists dispatches through the same wired PropertyPicker as exists", () => {
    const expr: Expression = { notExists: { path: "$.eventData.order.total" } };
    renderNode(expr);

    expect(screen.getByText("Not Exists")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select a field" })).toBeInTheDocument();
  });

  // The dispatch-only test above proves notExists routes through the same code
  // path as exists, but doesn't itself drive reportPathError — a future change
  // that split the shared exists/notExists case block could regress just the
  // negated half with every existing test still green (code review finding).
  // These duplicate exists's own placeholder/collision/resolve coverage for
  // notExists specifically, closing that gap.
  it("reports a notExists leaf's placeholder path ($.) as blocking", async () => {
    const expr: Expression = { notExists: { path: "$." } };
    renderNode(expr);

    await waitFor(() => expect(reportPathError).toHaveBeenLastCalledWith(expect.any(String), true));
  });

  it("reports a notExists leaf whose path collides with an operator name ($.funnelStage) as blocking", async () => {
    const expr: Expression = { notExists: { path: "$.funnelStage" } };
    renderNode(expr);

    await waitFor(() => expect(reportPathError).toHaveBeenLastCalledWith(expect.any(String), true));
  });

  it("clears the blocking state for a notExists leaf once its path actually resolves", async () => {
    const expr: Expression = { notExists: { path: "$.total" } };
    renderResolvable(expr);

    await waitFor(() =>
      expect(reportPathError).toHaveBeenLastCalledWith(expect.any(String), false)
    );
  });

  it("reports an exists leaf's placeholder path ($.) as blocking, matching the comparison-family behavior", async () => {
    const expr: Expression = { exists: { path: "$." } };
    renderNode(expr);

    await waitFor(() => expect(reportPathError).toHaveBeenLastCalledWith(expect.any(String), true));
  });

  it("reports an exists leaf whose path collides with an operator name ($.funnelStage) as blocking", async () => {
    const expr: Expression = { exists: { path: "$.funnelStage" } };
    renderNode(expr);

    await waitFor(() => expect(reportPathError).toHaveBeenLastCalledWith(expect.any(String), true));
  });

  it("clears the blocking state for an exists leaf once its path actually resolves", async () => {
    const expr: Expression = { exists: { path: "$.total" } };
    renderResolvable(expr);

    await waitFor(() =>
      expect(reportPathError).toHaveBeenLastCalledWith(expect.any(String), false)
    );
  });

  it("empty dispatches through PropertyPicker and reports its placeholder path as blocking", async () => {
    const expr: Expression = { empty: { path: "$." } };
    renderNode(expr);

    expect(screen.getByText("Is Empty")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select a field" })).toBeInTheDocument();
    await waitFor(() => expect(reportPathError).toHaveBeenLastCalledWith(expect.any(String), true));
  });

  // council review (F6): the empty/notEmpty pair was under-covered symmetrically
  // (neither had collision or resolve tests), not asymmetrically negated-vs-positive
  // like the original finding assumed for notExists/notEmpty. Closing both here.
  it("reports an empty leaf whose path collides with an operator name ($.funnelStage) as blocking", async () => {
    const expr: Expression = { empty: { path: "$.funnelStage" } };
    renderNode(expr);

    await waitFor(() => expect(reportPathError).toHaveBeenLastCalledWith(expect.any(String), true));
  });

  it("clears the blocking state for an empty leaf once its path actually resolves", async () => {
    const expr: Expression = { empty: { path: "$.total" } };
    renderResolvable(expr);

    await waitFor(() =>
      expect(reportPathError).toHaveBeenLastCalledWith(expect.any(String), false)
    );
  });

  it("notEmpty dispatches through the same wired PropertyPicker as empty", () => {
    const expr: Expression = { notEmpty: { path: "$.eventData.order.total" } };
    renderNode(expr);

    expect(screen.getByText("Is Not Empty")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select a field" })).toBeInTheDocument();
  });

  it("reports a notEmpty leaf whose path collides with an operator name ($.funnelStage) as blocking", async () => {
    const expr: Expression = { notEmpty: { path: "$.funnelStage" } };
    renderNode(expr);

    await waitFor(() => expect(reportPathError).toHaveBeenLastCalledWith(expect.any(String), true));
  });

  it("clears the blocking state for a notEmpty leaf once its path actually resolves", async () => {
    const expr: Expression = { notEmpty: { path: "$.total" } };
    renderResolvable(expr);

    await waitFor(() =>
      expect(reportPathError).toHaveBeenLastCalledWith(expect.any(String), false)
    );
  });

  // Same gap-closing reasoning as notExists above (code review finding): empty's
  // dispatch-only test doesn't drive reportPathError for the negated operator.
  it("reports a notEmpty leaf's placeholder path ($.) as blocking", async () => {
    const expr: Expression = { notEmpty: { path: "$." } };
    renderNode(expr);

    await waitFor(() => expect(reportPathError).toHaveBeenLastCalledWith(expect.any(String), true));
  });

  it("eventSum dispatches through PropertyPicker and clears once its path resolves", async () => {
    const expr: Expression = {
      eventSum: { eventTypeCode: "ORDER_PLACED", fieldPath: "$.total", minSum: 1 },
    };
    renderEventSum(expr, RESOLVABLE_MODEL);

    expect(screen.getByText("Event Sum")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select a field" })).toBeInTheDocument();
    await waitFor(() =>
      expect(reportPathError).toHaveBeenLastCalledWith(expect.any(String), false)
    );
  });

  it("reports an eventSum leaf's placeholder path as blocking", async () => {
    const expr: Expression = {
      eventSum: { eventTypeCode: "ORDER_PLACED", fieldPath: "$.", minSum: 1 },
    };
    renderEventSum(expr);

    await waitFor(() => expect(reportPathError).toHaveBeenLastCalledWith(expect.any(String), true));
  });

  // The plan explicitly named eventSum alongside exists for the collision
  // scenario; only exists had it (code review finding).
  it("reports an eventSum leaf whose path collides with an operator name ($.funnelStage) as blocking", async () => {
    const expr: Expression = {
      eventSum: { eventTypeCode: "ORDER_PLACED", fieldPath: "$.funnelStage", minSum: 1 },
    };
    renderEventSum(expr);

    await waitFor(() => expect(reportPathError).toHaveBeenLastCalledWith(expect.any(String), true));
  });
});

describe("ExpressionNode — multi-value sentence layout (AE6, fix #8, fix #11)", () => {
  it("renders between as two inline inputs joined by 'and' and writes bound edits", () => {
    const expr: Expression = {
      between: {
        path: "$.eventData.order.total",
        lowerBound: 10,
        upperBound: 100,
        extractValueFromPath: false,
      },
    };
    const { onChange } = renderNode(expr);

    const lower = screen.getByRole("spinbutton", { name: "Lower bound" });
    const upper = screen.getByRole("spinbutton", { name: "Upper bound" });
    expect(lower).toHaveValue(10);
    expect(upper).toHaveValue(100);
    expect(screen.getByText("and")).toBeInTheDocument();

    fireEvent.change(lower, { target: { value: "20" } });

    expect(onChange).toHaveBeenLastCalledWith({
      between: {
        path: "$.eventData.order.total",
        lowerBound: 20,
        upperBound: 100,
        extractValueFromPath: false,
      },
    });
  });

  it("shows a non-error placeholder for a partially filled between (only lowerBound set)", () => {
    const expr: Expression = {
      between: {
        path: "$.eventData.order.total",
        lowerBound: 10,
        upperBound: undefined as unknown as number,
        extractValueFromPath: false,
      },
    };
    renderNode(expr);

    const upper = screen.getByRole("spinbutton", { name: "Upper bound" });
    expect(upper).toHaveValue(null);
    expect(upper).toHaveAttribute("placeholder", "Upper bound");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders `in` values as a chip list with a per-chip remove control meeting the 44x44 target", () => {
    const expr: Expression = {
      in: { path: "$.eventData.order.status", values: ["paid"], extractValues: false },
    };
    const { onChange } = renderNode(expr);

    expect(screen.getByText("paid")).toBeInTheDocument();
    const removeBtn = screen.getByRole("button", { name: "Remove paid" });
    expect(removeBtn.className).toMatch(/h-11/);
    expect(removeBtn.className).toMatch(/w-11/);

    fireEvent.click(removeBtn);

    expect(onChange).toHaveBeenLastCalledWith({
      in: { path: "$.eventData.order.status", values: [], extractValues: false },
    });
  });

  it("adds a new value via the add-value affordance", () => {
    const expr: Expression = {
      in: { path: "$.eventData.order.status", values: [], extractValues: false },
    };
    const { onChange } = renderNode(expr);

    fireEvent.change(screen.getByRole("textbox", { name: "New value" }), {
      target: { value: "shipped" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add value" }));

    expect(onChange).toHaveBeenLastCalledWith({
      in: { path: "$.eventData.order.status", values: ["shipped"], extractValues: false },
    });
  });

  it("shows a non-error empty state for an `in` leaf with no values yet", () => {
    const expr: Expression = {
      in: { path: "$.eventData.order.status", values: [], extractValues: false },
    };
    renderNode(expr);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add value" })).toBeInTheDocument();
  });
});

describe("ExpressionNode — card presentation regression (R6a, fix #17)", () => {
  it("renders the existing Card-based leaf unchanged when presentation is card (the default)", () => {
    const expr: Expression = {
      greaterThan: { path: "$.eventData.order.total", value: 100, extractValueFromPath: false },
    };
    renderNode(expr, { presentation: "card" });

    // Card mode keeps the collapsible header + card-mode NumericExpressionComponent...
    expect(screen.getByText("Compare to")).toBeInTheDocument();
    // ...and none of the sentence-mode field pill (PropertyPicker's "Field: …"
    // trigger only appears under presentation="sentence"; card mode keeps its
    // own breadcrumb-style JsonPathInput trigger instead).
    expect(screen.queryByRole("button", { name: /Field:/ })).not.toBeInTheDocument();
  });
});
