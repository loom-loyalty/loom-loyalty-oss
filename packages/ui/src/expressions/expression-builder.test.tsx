import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { ExpressionBuilder } from "./expression-builder";
import { ExpressionContextProvider } from "./expression-context";
import { ExpressionTypeSelector } from "./expression-type-selector";
import type { Expression } from "./types";

// Radix Select relies on pointer-capture + scrollIntoView, which jsdom lacks.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

/**
 * Fix A: surface gating must be authoritative via the expression context at
 * every depth. Nested composites pass no `mode`/`surface` down, so a selector
 * must read the surface from context — otherwise nested AND/OR/NOT wrongly
 * resolve to the "event" fallback and hide the audience-only aggregate ops.
 */
describe("ExpressionTypeSelector — surface is authoritative from context", () => {
  it("offers the audience-only ops on the customer surface even when the prop says event", async () => {
    const user = userEvent.setup();
    render(
      <ExpressionContextProvider mode="customer">
        <ExpressionTypeSelector surface="event" onSelect={vi.fn()} />
      </ExpressionContextProvider>
    );

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByRole("option", { name: "Funnel Stage" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Event Count" })).toBeInTheDocument();
  });

  it("hides the audience-only ops on the event surface even when the prop says customer", async () => {
    const user = userEvent.setup();
    render(
      <ExpressionContextProvider mode="event">
        <ExpressionTypeSelector surface="customer" onSelect={vi.fn()} />
      </ExpressionContextProvider>
    );

    await user.click(screen.getByRole("combobox"));

    // The dropdown is open (comparison ops are present) …
    expect(await screen.findByRole("option", { name: "Between" })).toBeInTheDocument();
    // … but the audience-only aggregates are gated out.
    expect(screen.queryByRole("option", { name: "Funnel Stage" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Event Count" })).not.toBeInTheDocument();
  });
});

describe("ExpressionBuilder — nested surface gating", () => {
  // Root AND → nested AND → leaf. Combobox DOM order is deterministic:
  // [0] root type-selector, [1] nested AND "add child", [2] root "add child"
  // (leaves render no selector; depth>0 composites show a Badge, not a selector).
  const nestedTree: Expression = {
    and: { children: [{ and: { children: [{ true: {} }] } } as Expression] },
  };
  const NESTED_ADD_CHILD = 1;

  it("offers eventCount/funnelStage in a nested AND on the customer surface", async () => {
    const user = userEvent.setup();
    render(
      <ExpressionBuilder expression={nestedTree} onChange={vi.fn()} dataModelCode="customer" />
    );

    const nestedAddChild = screen.getAllByRole("combobox")[NESTED_ADD_CHILD]!;
    await user.click(nestedAddChild);

    expect(await screen.findByRole("option", { name: "Funnel Stage" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Event Count" })).toBeInTheDocument();
  });

  it("hides eventCount/funnelStage in a nested AND on the event surface", async () => {
    const user = userEvent.setup();
    render(
      <ExpressionBuilder expression={nestedTree} onChange={vi.fn()} dataModelCode="TRANSACTION" />
    );

    const nestedAddChild = screen.getAllByRole("combobox")[NESTED_ADD_CHILD]!;
    await user.click(nestedAddChild);

    expect(await screen.findByRole("option", { name: "Between" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Funnel Stage" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Event Count" })).not.toBeInTheDocument();
  });
});

/**
 * The surface is the CONSUMER's decision, decoupled from dataModelCode. An explicit
 * `mode` wins over the dataModelCode-derived default — so a single-event rule whose
 * event type maps to the customer data model (e.g. customer.updated) still hides the
 * audience-only aggregate ops, at root AND nested.
 */
describe("ExpressionBuilder — explicit surface is decoupled from dataModelCode", () => {
  const nestedTree: Expression = {
    and: { children: [{ and: { children: [{ true: {} }] } } as Expression] },
  };
  const NESTED_ADD_CHILD = 1;

  it("forces the event surface at ROOT even when dataModelCode is customer", async () => {
    const user = userEvent.setup();
    render(
      <ExpressionBuilder
        expression={null}
        onChange={vi.fn()}
        dataModelCode="customer"
        mode="event"
      />
    );

    await user.click(screen.getByRole("combobox"));

    // Picker is open (a cross-surface op is present) …
    expect(await screen.findByRole("option", { name: "Between" })).toBeInTheDocument();
    // … but the audience-only aggregates are gated out despite dataModelCode=customer.
    expect(screen.queryByRole("option", { name: "Funnel Stage" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Event Count" })).not.toBeInTheDocument();
  });

  it("forces the event surface inside a NESTED AND even when dataModelCode is customer", async () => {
    const user = userEvent.setup();
    render(
      <ExpressionBuilder
        expression={nestedTree}
        onChange={vi.fn()}
        dataModelCode="customer"
        mode="event"
      />
    );

    const nestedAddChild = screen.getAllByRole("combobox")[NESTED_ADD_CHILD]!;
    await user.click(nestedAddChild);

    expect(await screen.findByRole("option", { name: "Between" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Funnel Stage" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Event Count" })).not.toBeInTheDocument();
  });

  it("forces the customer surface even when dataModelCode is non-customer", async () => {
    const user = userEvent.setup();
    render(
      <ExpressionBuilder
        expression={null}
        onChange={vi.fn()}
        dataModelCode="TRANSACTION"
        mode="customer"
      />
    );

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByRole("option", { name: "Funnel Stage" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Event Count" })).toBeInTheDocument();
  });
});

/**
 * U4 — sentence-mode composite presentation (Match All/Any toggle, "+ Add
 * group", and the `not` negation header). Card-mode presentation (the
 * default) must stay byte-for-byte unchanged for every non-modal consumer
 * (R6a, fix #17).
 */
describe("CompositeExpressionBuilder — sentence mode (U4)", () => {
  it("renames the root match mode from Single to One without changing its internal value", () => {
    render(<ExpressionBuilder expression={null} onChange={vi.fn()} presentation="sentence" />);

    expect(screen.getByRole("radio", { name: "One condition" })).toHaveTextContent("One");
    expect(screen.queryByRole("radio", { name: "Single condition" })).not.toBeInTheDocument();
  });

  it("prefixes a single root sentence leaf with WHEN", () => {
    render(
      <ExpressionBuilder expression={{ true: {} }} onChange={vi.fn()} presentation="sentence" />
    );

    expect(screen.getByText("WHEN")).toHaveAttribute("data-slot", "expression-row-prefix");
  });

  it("adds WHEN/AND/OR/IF prefixes only to sentence-mode rows and recesses nested groups", () => {
    const tree: Expression = {
      and: {
        children: [
          { true: {} },
          { or: { children: [{ true: {} }, { and: { children: [{ true: {} }, { true: {} }] } }] } },
        ],
      },
    };
    const { container } = render(
      <ExpressionBuilder expression={tree} onChange={vi.fn()} presentation="sentence" />
    );

    const prefixes = Array.from(
      container.querySelectorAll<HTMLElement>('[data-slot="expression-row-prefix"]')
    ).map((prefix) => prefix.textContent);
    expect(prefixes).toEqual(["WHEN", "AND", "IF", "OR", "IF", "AND"]);
    expect(container.querySelectorAll('[data-slot="expression-group"].bg-muted\\/30')).toHaveLength(
      2
    );
    expect(
      container.querySelectorAll('[data-slot="expression-group"].rounded-xl.border-l-\\[3px\\]')
    ).toHaveLength(2);
    // The root itself stays flat — no box, no colored rail — matching the
    // design reference where only an explicitly-created nested group is
    // boxed. Only the two nested groups above carry any container styling.
    expect(container.querySelectorAll('[data-slot="expression-group"].border-l-4')).toHaveLength(0);
  });

  it("keeps card-mode rows and the legacy composite rail unchanged", () => {
    const tree: Expression = { and: { children: [{ true: {} }, { true: {} }] } };
    const { container } = render(<ExpressionBuilder expression={tree} onChange={vi.fn()} />);

    expect(container.querySelector('[data-slot="expression-row-prefix"]')).toBeNull();
    expect(container.querySelectorAll('[data-slot="expression-group"].border-l-4')).toHaveLength(1);
    expect(container.querySelector('[data-slot="expression-group"].bg-muted\\/30')).toBeNull();
  });

  it("does not add prefixes to any child of a multi-child not composite", () => {
    const tree: Expression = { not: { children: [{ true: {} }, { true: {} }] } };
    const { container } = render(
      <ExpressionBuilder expression={tree} onChange={vi.fn()} presentation="sentence" />
    );

    expect(screen.getByText("Does NOT match")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="expression-row-prefix"]')).toBeNull();
    // Root-level composites (any type, including `not`) render flat in
    // sentence mode — no box, no colored rail.
    expect(container.querySelector(".border-l-destructive.border-l-4")).toBeNull();
  });

  it('keeps "One" visible (not swapped away) when the root is promoted to a composite, disabling it only once 2+ children exist (reported UX bug)', async () => {
    const user = userEvent.setup();

    // Two children: "One" must still render, just disabled — nothing sensible
    // to collapse two conditions into.
    const twoChildTree: Expression = { and: { children: [{ true: {} }, { true: {} }] } };
    const { rerender } = render(
      <ExpressionBuilder expression={twoChildTree} onChange={vi.fn()} presentation="sentence" />
    );
    expect(screen.getByRole("radio", { name: "One condition" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Match All" })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    // One child: "One" is enabled, and selecting it collapses the composite
    // back to the bare child — no wrapper left behind.
    const handleChange = vi.fn();
    const oneChildTree: Expression = { and: { children: [{ true: {} }] } };
    rerender(
      <ExpressionBuilder
        expression={oneChildTree}
        onChange={handleChange}
        presentation="sentence"
      />
    );
    const oneRadio = screen.getByRole("radio", { name: "One condition" });
    expect(oneRadio).not.toBeDisabled();

    await user.click(oneRadio);
    expect(handleChange).toHaveBeenCalledWith({ true: {} });
  });

  it("carries the group's actions onto the promoted child when collapsing to One (Codex review F1 — actions were silently dropped)", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const tree: Expression = {
      and: {
        children: [{ true: {} }],
        actions: [{ issueCustomerBadge: { badgeId: "b1" } }],
      },
    } as unknown as Expression;
    render(<ExpressionBuilder expression={tree} onChange={handleChange} presentation="sentence" />);

    await user.click(screen.getByRole("radio", { name: "One condition" }));

    expect(handleChange).toHaveBeenCalledWith({
      true: { actions: [{ issueCustomerBadge: { badgeId: "b1" } }] },
    });
  });

  it("merges (not overwrites) the child's own actions with the group's when collapsing to One (Codex review, second pass)", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const tree: Expression = {
      and: {
        children: [{ true: { actions: [{ issueCustomerBadge: { badgeId: "child-badge" } }] } }],
        actions: [{ issueCustomerBadge: { badgeId: "group-badge" } }],
      },
    } as unknown as Expression;
    render(<ExpressionBuilder expression={tree} onChange={handleChange} presentation="sentence" />);

    await user.click(screen.getByRole("radio", { name: "One condition" }));

    expect(handleChange).toHaveBeenCalledWith({
      true: {
        actions: [
          { issueCustomerBadge: { badgeId: "child-badge" } },
          { issueCustomerBadge: { badgeId: "group-badge" } },
        ],
      },
    });
  });

  it("toggles Match All <-> Match Any, switching and/or while preserving children", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const tree: Expression = { and: { children: [{ true: {} }, { true: {} }] } };
    render(<ExpressionBuilder expression={tree} onChange={handleChange} presentation="sentence" />);

    // Starts as Match All (and); toggling to Match Any switches the AST key only.
    expect(screen.getByRole("radio", { name: "Match All" })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    await user.click(screen.getByRole("radio", { name: "Match Any" }));

    expect(handleChange).toHaveBeenCalledWith({
      or: { children: (tree as unknown as { and: { children: Expression[] } }).and.children },
    });
  });

  it("renders a persisted `not` composite with its own negation header, never the Match toggle", () => {
    const handleChange = vi.fn();
    const tree: Expression = { not: { children: [{ true: {} }] } };
    const { container } = render(
      <ExpressionBuilder expression={tree} onChange={handleChange} presentation="sentence" />
    );

    expect(screen.getByText("Does NOT match")).toBeInTheDocument();
    // Structural guard (KTD12/fix #10): no control on a `not` node offers and/or.
    expect(screen.queryByRole("radio", { name: "Match All" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Match Any" })).not.toBeInTheDocument();
    // Root composites render flat in sentence mode — no colored rail box.
    expect(container.querySelector(".border-l-destructive")).toBeNull();
    // The single child still renders and is editable (TrueExpressionComponent).
    expect(screen.getByText(/always evaluates to true/i)).toBeInTheDocument();
  });

  it("round-trips a `not` composite unchanged — no conversion to and/or, no loss", () => {
    const tree: Expression = { not: { children: [{ true: {} }] } };
    render(<ExpressionBuilder expression={tree} onChange={vi.fn()} presentation="sentence" />);

    // Nothing in this render path can mutate the tree without a user action;
    // the AST passed in is exactly what's rendered (no conversion, no drop).
    expect(tree).toEqual({ not: { children: [{ true: {} }] } });
  });

  it('inserts a nested and/or group via "+ Add group", keeping the tree flat until then', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const tree: Expression = { and: { children: [{ true: {} }] } };
    const { container } = render(
      <ExpressionBuilder expression={tree} onChange={handleChange} presentation="sentence" />
    );

    // Flat: the root has no colored-rail box at all in sentence mode.
    expect(container.querySelectorAll(".border-l-4")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: /add group/i }));

    expect(handleChange).toHaveBeenCalledTimes(1);
    const next = handleChange.mock.calls[0]![0] as unknown as {
      and: { children: Expression[] };
    };
    expect(next.and.children).toHaveLength(2);
    // The new child is a nested "and" group (the existing add-child-composite
    // path, seeded empty) — its colored rail maps to the primary token.
    expect(next.and.children[1]).toEqual({ and: { children: [] } });
  });

  it("does not offer and/or/not from the sentence-mode 'Add condition' selector", async () => {
    const user = userEvent.setup();
    const tree: Expression = { and: { children: [{ true: {} }] } };
    render(<ExpressionBuilder expression={tree} onChange={vi.fn()} presentation="sentence" />);

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByRole("option", { name: "Equals" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "AND" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "OR" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "NOT" })).not.toBeInTheDocument();
  });

  it("shows the existing max-depth message past MAX_DEPTH in sentence mode", () => {
    let tree: Expression = { true: {} };
    for (let i = 0; i < 6; i++) {
      tree = { and: { children: [tree] } };
    }
    render(<ExpressionBuilder expression={tree} onChange={vi.fn()} presentation="sentence" />);

    expect(screen.getByText("Maximum nesting depth (5) reached.")).toBeInTheDocument();
  });

  it("shows the existing node-count warning for large trees in sentence mode", () => {
    const tree: Expression = {
      and: { children: Array.from({ length: 55 }, () => ({ true: {} }) as Expression) },
    };
    render(<ExpressionBuilder expression={tree} onChange={vi.fn()} presentation="sentence" />);

    expect(screen.getByText(/This expression tree has 56 nodes/)).toBeInTheDocument();
  });

  it("regression: default card presentation renders the full selector, not the sentence-mode controls", async () => {
    const user = userEvent.setup();
    const tree: Expression = { and: { children: [{ true: {} }] } };
    render(<ExpressionBuilder expression={tree} onChange={vi.fn()} />);

    // Card mode keeps the existing combobox-based type selector...
    expect(screen.queryByRole("radio", { name: "Match All" })).not.toBeInTheDocument();
    expect(screen.queryByText("Add group")).not.toBeInTheDocument();
    // ...the first combobox is the depth-0 header type selector (and/or/not/leaf).
    await user.click(screen.getAllByRole("combobox")[0]!);
    expect(await screen.findByRole("option", { name: "OR" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "NOT" })).toBeInTheDocument();
  });
});
