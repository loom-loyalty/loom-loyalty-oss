import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  CommandPalette,
  type CommandPaletteResult,
  type CommandPaletteScope,
} from "../command-palette";
import { isEditableElement, useCommandPaletteShortcut } from "../use-command-palette-shortcut";

function makeResult(overrides: Partial<CommandPaletteResult> = {}): CommandPaletteResult {
  return {
    displayLabel: "Coffee Rewards",
    entityId: "prog_abc",
    entityType: "PROGRAM",
    snippetText: "Earn points on every coffee purchase",
    matchRanges: [{ start: 21, end: 27 }], // "coffee"
    score: 0.92,
    sourceUrl: "/programs/prog_abc",
    ...overrides,
  };
}

describe("CommandPalette", () => {
  it("shows the idle hint when the query is empty", () => {
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        query=""
        onQueryChange={() => {}}
        results={[]}
        onSelect={() => {}}
      />
    );
    expect(screen.getByText(/pick a scope above to narrow/i)).toBeInTheDocument();
  });

  it("nudges to keep typing when the query is below the minimum length", () => {
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        query="co"
        onQueryChange={() => {}}
        results={[]}
        onSelect={() => {}}
      />
    );
    expect(screen.getByText(/at least 3 characters needed/i)).toBeInTheDocument();
  });

  it("renders results grouped by entityType with humanized headings", () => {
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        query="coffee"
        onQueryChange={() => {}}
        results={[
          makeResult({ entityType: "PROGRAM", entityId: "prog_1", displayLabel: "Coffee Plus" }),
          makeResult({
            entityType: "OFFER",
            entityId: "ofr_1",
            displayLabel: "Coffee 2-for-1",
            snippetText: "Buy one coffee get one",
            matchRanges: [{ start: 8, end: 14 }],
          }),
        ]}
        onSelect={() => {}}
        entityTypeLabels={{ PROGRAM: "Programs", OFFER: "Offers" }}
      />
    );
    expect(screen.getByText("Programs")).toBeInTheDocument();
    expect(screen.getByText("Offers")).toBeInTheDocument();
    expect(screen.getByText("Coffee Plus")).toBeInTheDocument();
    expect(screen.getByText("Coffee 2-for-1")).toBeInTheDocument();
  });

  it("highlights every match range with <mark>", () => {
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        query="coffee"
        onQueryChange={() => {}}
        results={[
          makeResult({
            displayLabel: "Coffee Plus",
            snippetText: "coffee and coffee",
            matchRanges: [
              { start: 0, end: 6 },
              { start: 11, end: 17 },
            ],
          }),
        ]}
        onSelect={() => {}}
      />
    );
    const marks = screen.getAllByText("coffee", { selector: "mark" });
    expect(marks).toHaveLength(2);
  });

  it("calls onSelect and closes when an item is chosen", () => {
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    const result = makeResult();
    render(
      <CommandPalette
        open
        onOpenChange={onOpenChange}
        query="coffee"
        onQueryChange={() => {}}
        results={[result]}
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByText("Coffee Rewards"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ entityId: "prog_abc" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("offers the didYouMean suggestion as a clickable button on no-result", () => {
    const onDidYouMeanClick = vi.fn();
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        query="coffe"
        onQueryChange={() => {}}
        results={[]}
        onSelect={() => {}}
        didYouMean="coffee"
        onDidYouMeanClick={onDidYouMeanClick}
      />
    );
    const suggestion = screen.getByRole("button", { name: "coffee" });
    fireEvent.click(suggestion);
    expect(onDidYouMeanClick).toHaveBeenCalledWith("coffee");
  });

  it("renders the rate-limited copy when errorState is 'rate-limited'", () => {
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        query="coffee"
        onQueryChange={() => {}}
        results={[]}
        errorState="rate-limited"
        onSelect={() => {}}
      />
    );
    expect(screen.getByText(/slow down a moment/i)).toBeInTheDocument();
  });

  it("renders results regardless of cmdk's internal filter (shouldFilter is disabled)", () => {
    // Items' value is the entityId — cmdk's fuzzy filter would drop them
    // against the user-typed query if shouldFilter were on. This test guards
    // the wiring that turns it off.
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        query="zzz-nothing-would-match"
        onQueryChange={() => {}}
        results={[makeResult()]}
        onSelect={() => {}}
      />
    );
    expect(screen.getByText("Coffee Rewards")).toBeInTheDocument();
  });

  it("clamps out-of-bounds match ranges to the snippet length", () => {
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        query="x"
        onQueryChange={() => {}}
        results={[
          makeResult({
            snippetText: "short",
            matchRanges: [{ start: 0, end: 9999 }],
          }),
        ]}
        onSelect={() => {}}
      />
    );
    const mark = screen.getByText("short", { selector: "mark" });
    expect(mark).toBeInTheDocument();
  });

  it("falls back to the entityType for groups not in entityTypeLabels", () => {
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        query="coffee"
        onQueryChange={() => {}}
        results={[makeResult({ entityType: "CUSTOM_TYPE" })]}
        onSelect={() => {}}
      />
    );
    // humanized: "Custom types"
    expect(screen.getByText(/custom types/i)).toBeInTheDocument();
  });
});

describe("useCommandPaletteShortcut", () => {
  it("toggles open state on Cmd+K", () => {
    const setOpen = vi.fn();
    renderHook(() => useCommandPaletteShortcut(setOpen));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
    });
    expect(setOpen).toHaveBeenCalledTimes(1);
  });

  it("also toggles on Ctrl+K (non-mac)", () => {
    const setOpen = vi.fn();
    renderHook(() => useCommandPaletteShortcut(setOpen));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    });
    expect(setOpen).toHaveBeenCalledTimes(1);
  });

  it("ignores plain k", () => {
    const setOpen = vi.fn();
    renderHook(() => useCommandPaletteShortcut(setOpen));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k" }));
    });
    expect(setOpen).not.toHaveBeenCalled();
  });

  it("recognizes contenteditable elements via isEditableElement", () => {
    // jsdom doesn't implement `isContentEditable` and doesn't reliably move
    // focus onto a contentEditable <div>, so we unit-test the predicate
    // directly. In a real browser the hook reads `document.activeElement` /
    // `event.target` and feeds them to this same predicate.
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    expect(isEditableElement(editable)).toBe(true);

    const input = document.createElement("input");
    expect(isEditableElement(input)).toBe(false);

    expect(isEditableElement(null)).toBe(false);
  });

  it("still toggles when a plain <input> is focused (search should beat input typing)", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    const setOpen = vi.fn();
    renderHook(() => useCommandPaletteShortcut(setOpen));
    act(() => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
    });
    expect(setOpen).toHaveBeenCalledTimes(1);
    document.body.removeChild(input);
  });
});

describe("CommandPalette scopes", () => {
  const SCOPES: CommandPaletteScope[] = [
    { key: "CUSTOMER", label: "Customers" },
    { key: "PROGRAM", label: "Programs" },
    { key: "EVENT_RULE", label: "Event rules" },
  ];

  it("renders the scope rail with one chip per scope plus an All reset", () => {
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        query=""
        onQueryChange={() => {}}
        results={[]}
        onSelect={() => {}}
        scopes={SCOPES}
      />
    );
    const rail = screen.getByRole("group", { name: /scope filters/i });
    expect(rail).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Customers" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Event rules" })).toBeInTheDocument();
  });

  it("filters visible results by active scope", () => {
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        query="x"
        onQueryChange={() => {}}
        results={[
          makeResult({ entityType: "PROGRAM", entityId: "prog_a", displayLabel: "Program A" }),
          makeResult({
            entityType: "EVENT_RULE",
            entityId: "evt_a",
            displayLabel: "Event Rule A",
          }),
        ]}
        onSelect={() => {}}
        scopes={SCOPES}
        activeScope="EVENT_RULE"
      />
    );
    expect(screen.getByText("Event Rule A")).toBeInTheDocument();
    expect(screen.queryByText("Program A")).not.toBeInTheDocument();
  });

  it("calls onActiveScopeChange when a chip is clicked", () => {
    const onChange = vi.fn();
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        query=""
        onQueryChange={() => {}}
        results={[]}
        onSelect={() => {}}
        scopes={SCOPES}
        activeScope={null}
        onActiveScopeChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Event rules" }));
    expect(onChange).toHaveBeenCalledWith("EVENT_RULE");
  });

  it("toggles a chip off when clicked again", () => {
    const onChange = vi.fn();
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        query=""
        onQueryChange={() => {}}
        results={[]}
        onSelect={() => {}}
        scopes={SCOPES}
        activeScope="EVENT_RULE"
        onActiveScopeChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Event rules" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("surfaces the smart suggestion when typed text matches a scope label", () => {
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        query="event rule"
        onQueryChange={() => {}}
        results={[]}
        onSelect={() => {}}
        scopes={SCOPES}
      />
    );
    expect(screen.getByText(/Search only Event rules/i)).toBeInTheDocument();
  });

  it("hides the smart suggestion once a scope is already active", () => {
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        query="event rule"
        onQueryChange={() => {}}
        results={[]}
        onSelect={() => {}}
        scopes={SCOPES}
        activeScope="EVENT_RULE"
      />
    );
    expect(screen.queryByText(/Search only Event rules/i)).not.toBeInTheDocument();
  });

  it("applies the suggested scope when the suggestion item is chosen", () => {
    const onScopeChange = vi.fn();
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        query="event rule"
        onQueryChange={() => {}}
        results={[]}
        onSelect={() => {}}
        scopes={SCOPES}
        onActiveScopeChange={onScopeChange}
      />
    );
    fireEvent.click(screen.getByText(/Search only Event rules/i));
    expect(onScopeChange).toHaveBeenCalledWith("EVENT_RULE");
  });

  it("marks scopes with requiresPrefix using a lock affordance + title", () => {
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        query=""
        onQueryChange={() => {}}
        results={[]}
        onSelect={() => {}}
        scopes={[
          { key: "CUSTOMER", label: "Customers", requiresPrefix: true },
          { key: "PROGRAM", label: "Programs" },
        ]}
      />
    );
    const customers = screen.getByRole("button", { name: /Customers/ });
    expect(customers).toHaveAttribute("title", expect.stringMatching(/only show up when scoped/i));
    const programs = screen.getByRole("button", { name: "Programs" });
    expect(programs).not.toHaveAttribute("title");
  });

  it("does not surface a smart suggestion for short or ambiguous tokens", () => {
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        query="ab"
        onQueryChange={() => {}}
        results={[]}
        onSelect={() => {}}
        scopes={SCOPES}
      />
    );
    expect(screen.queryByText(/Search only/i)).not.toBeInTheDocument();
  });
});

describe("CommandPalette dialog title + description for screen readers", () => {
  it("names the dialog accessibly with the Search title", () => {
    render(
      <CommandPalette
        open
        onOpenChange={() => {}}
        query=""
        onQueryChange={() => {}}
        results={[]}
        onSelect={() => {}}
      />
    );
    const dialog = screen.getByRole("dialog", { name: "Search" });
    expect(dialog).toBeInTheDocument();
  });
});
