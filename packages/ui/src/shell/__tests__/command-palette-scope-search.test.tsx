import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  CommandPalette,
  type CommandPaletteQuickAction,
  type CommandPaletteResult,
  type CommandPaletteScope,
} from "../command-palette";

const scopes: CommandPaletteScope[] = [
  { key: "CUSTOMER", label: "Customers", prefix: "customer", requiresPrefix: true },
  { key: "PROGRAM", label: "Programs", prefix: "program" },
];

function makeResult(overrides: Partial<CommandPaletteResult> = {}): CommandPaletteResult {
  return {
    displayLabel: "Marisol Rewards",
    entityId: "prog_1",
    entityType: "PROGRAM",
    snippetText: "Marisol Rewards",
    matchRanges: [],
    score: 0.9,
    sourceUrl: "/programs/prog_1",
    ...overrides,
  };
}

function renderPalette(props: Partial<React.ComponentProps<typeof CommandPalette>> = {}) {
  const onActiveScopeChange = vi.fn();
  const onSelect = vi.fn();
  const onQuickActionSelect = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <CommandPalette
      open
      onOpenChange={onOpenChange}
      query="Marisol"
      onQueryChange={() => {}}
      results={[]}
      onSelect={onSelect}
      scopes={scopes}
      onActiveScopeChange={onActiveScopeChange}
      onQuickActionSelect={onQuickActionSelect}
      {...props}
    />
  );
  return { onActiveScopeChange, onSelect, onQuickActionSelect, onOpenChange };
}

const searchCustomersRow = () =>
  screen.queryByRole("option", { name: /search customers for .*marisol/i });

describe("CommandPalette — inline scope search row (brief A)", () => {
  it("A1: ends the result list with 'Search customers for …' when results exist", () => {
    renderPalette({ results: [makeResult()] });
    const options = screen.getAllByRole("option");
    expect(options[options.length - 1]).toHaveAccessibleName(/search customers for .*marisol/i);
  });

  it("A2: with no matches, puts the row first and still says 'No matches'", () => {
    renderPalette({ results: [] });
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAccessibleName(/search customers for .*marisol/i);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    const noMatches = screen.getByText("No matches");
    expect(
      options[0]!.compareDocumentPosition(noMatches) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("A2: pressing Enter with no matches runs the customer search", () => {
    const { onActiveScopeChange } = renderPalette({ results: [] });
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(onActiveScopeChange).toHaveBeenCalledWith("CUSTOMER");
  });

  it("A2: keeps the did-you-mean suggestion alongside the row", () => {
    renderPalette({ results: [], didYouMean: "Marigold" });
    expect(searchCustomersRow()).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marigold" })).toBeInTheDocument();
  });

  it("A3: choosing the row activates the customer scope and keeps the palette open", () => {
    const { onActiveScopeChange, onOpenChange, onSelect } = renderPalette({ results: [] });
    fireEvent.click(searchCustomersRow()!);
    expect(onActiveScopeChange).toHaveBeenCalledWith("CUSTOMER");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("A4: no row when a scope is already active", () => {
    renderPalette({ query: "customer:Marisol", activeScope: "CUSTOMER", effectiveQueryLength: 7 });
    expect(searchCustomersRow()).not.toBeInTheDocument();
  });

  it("A4: no row when the query is under the minimum length", () => {
    renderPalette({ query: "Ma" });
    expect(screen.queryByRole("option", { name: /search customers/i })).not.toBeInTheDocument();
  });

  it("A4: no row while a first search is still loading", () => {
    renderPalette({ isLoading: true });
    expect(searchCustomersRow()).not.toBeInTheDocument();
  });

  it("shows a single customer row when the query names the scope (no duplicate)", () => {
    renderPalette({ query: "customers", results: [] });
    expect(screen.getAllByRole("option", { name: /customers/i })).toHaveLength(1);
    expect(screen.getByRole("option", { name: /search only customers/i })).toBeInTheDocument();
  });

  it("does not render the row for scopes that do not require a prefix", () => {
    renderPalette({ results: [] });
    expect(screen.queryByRole("option", { name: /search programs for/i })).not.toBeInTheDocument();
  });

  it("gives the row a 44px touch target (WCAG 2.5.5, AGENTS.md)", () => {
    renderPalette({ results: [] });
    expect(searchCustomersRow()).toHaveClass("min-h-11");
  });

  it("does not render the row on a search error", () => {
    renderPalette({ errorState: "error" });
    expect(searchCustomersRow()).not.toBeInTheDocument();
    expect(screen.getByText("Search failed")).toBeInTheDocument();
  });
});

describe("CommandPalette — empty palette (brief D)", () => {
  const quickActions: CommandPaletteQuickAction[] = [
    { id: "customers", label: "Go to Customers", sourceUrl: "/customers" },
    { id: "audit", label: "Audit log", sourceUrl: "/audit-log" },
  ];
  const recentItems: CommandPaletteResult[] = [
    makeResult({ entityType: "CUSTOMER", entityId: "cust_1", displayLabel: "Maya Chen" }),
  ];

  it("D1: shows Recent and Quick actions groups when the query is empty", () => {
    renderPalette({ query: "", quickActions, recentItems });
    const recent = screen.getByRole("group", { name: "Recent" });
    expect(within(recent).getByRole("option", { name: /maya chen/i })).toBeInTheDocument();
    const actions = screen.getByRole("group", { name: "Quick actions" });
    expect(within(actions).getByRole("option", { name: /go to customers/i })).toBeInTheDocument();
  });

  it("D1: opening a recent item behaves like opening a result and closes the palette", () => {
    const { onSelect, onOpenChange } = renderPalette({ query: "", recentItems });
    fireEvent.click(screen.getByRole("option", { name: /maya chen/i }));
    expect(onSelect).toHaveBeenCalledWith(recentItems[0]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("D1: choosing a quick action hands it to the consumer and closes the palette", () => {
    const { onQuickActionSelect, onOpenChange } = renderPalette({ query: "", quickActions });
    fireEvent.click(screen.getByRole("option", { name: /audit log/i }));
    expect(onQuickActionSelect).toHaveBeenCalledWith(quickActions[1]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("D1: gives quick-action rows a 44px touch target", () => {
    renderPalette({ query: "", quickActions });
    expect(screen.getByRole("option", { name: /audit log/i })).toHaveClass("min-h-11");
  });

  it("D1: gives recent rows a 44px touch target", () => {
    renderPalette({ query: "", recentItems });
    expect(screen.getByRole("option", { name: /maya chen/i })).toHaveClass("min-h-11");
  });

  it("D2: hides the Recent group when there are no recent items", () => {
    renderPalette({ query: "", quickActions, recentItems: [] });
    expect(screen.queryByRole("group", { name: "Recent" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Quick actions" })).toBeInTheDocument();
  });

  it("D4: typing replaces both sections with search results", () => {
    renderPalette({ query: "Marisol", quickActions, recentItems, results: [makeResult()] });
    expect(screen.queryByRole("group", { name: "Recent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Quick actions" })).not.toBeInTheDocument();
  });

  it("falls back to the idle hint when there is nothing to show", () => {
    renderPalette({ query: "" });
    expect(screen.getByText(/pick a scope above to narrow/i)).toBeInTheDocument();
  });
});
