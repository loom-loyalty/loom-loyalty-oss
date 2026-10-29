import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ExpressionContextProvider, type DataModelLike } from "../expression-context";
import { PropertyPicker } from "./property-picker";

// `useExpressionPathValidation` is the modal's aggregation point (fix #11) —
// spy on it to assert PropertyPicker reports the correct blocking/non-blocking
// state without needing a full ExpressionModal (that wiring is U1's contract;
// this test only verifies U3's caller-side of it).
const reportPathError = vi.fn();
const reportFieldName = vi.fn();
vi.mock("../expression-modal.js", () => ({
  useExpressionPathValidation: () => ({ reportPathError, reportFieldName }),
}));

// Radix Popover relies on pointer-capture + scrollIntoView, which jsdom lacks.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

const MODELS: Record<string, DataModelLike> = {
  ORDER_PLACED: {
    elements: [
      { outputAttribute: "customer", name: "Customer", typeReference: "CUSTOMER_INFO" },
      { outputAttribute: "total", name: "Total", typeReference: "NUMBER" },
      { outputAttribute: "status", name: "Status", typeReference: "STRING" },
    ],
  },
  CUSTOMER_INFO: {
    elements: [{ outputAttribute: "address", name: "Address", typeReference: "ADDRESS_INFO" }],
  },
  ADDRESS_INFO: {
    elements: [{ outputAttribute: "zipCode", name: "ZIP Code", typeReference: "STRING" }],
  },
  CUSTOMER: {
    elements: [{ outputAttribute: "tier", name: "Tier", typeReference: "STRING" }],
  },
};

function makeFetchDataModel(overrides?: Record<string, () => Promise<DataModelLike>>) {
  return vi.fn((code: string) => {
    const upper = code.toUpperCase();
    if (overrides?.[upper]) return overrides[upper]!();
    const model = MODELS[upper];
    if (!model) return Promise.reject(new Error(`Unknown model ${upper}`));
    return Promise.resolve(model);
  });
}

function Harness({
  fetchDataModel,
  initialValue = "",
  dataModelCode,
  eventTypeCode,
  noEventType = false,
  noDataModel = false,
}: {
  fetchDataModel: (code: string) => Promise<DataModelLike>;
  initialValue?: string;
  dataModelCode?: string;
  eventTypeCode?: string;
  noEventType?: boolean;
  noDataModel?: boolean;
}): ReactNode {
  const [value, setValue] = useState(initialValue);
  return (
    <ExpressionContextProvider
      dataModelCode={noDataModel || noEventType ? undefined : (dataModelCode ?? "ORDER_PLACED")}
      eventTypeCode={eventTypeCode}
      mode="event"
      fetchDataModel={fetchDataModel}
    >
      <PropertyPicker value={value} onSelect={setValue} />
      <p data-testid="current-value">{value}</p>
    </ExpressionContextProvider>
  );
}

describe("PropertyPicker — no event type warning", () => {
  it("shows a non-error warning while no event type is configured and keeps manual entry available", async () => {
    const user = userEvent.setup();
    render(<Harness fetchDataModel={makeFetchDataModel()} noEventType />);

    await user.click(screen.getByRole("button", { name: "Select a field" }));
    const warning = screen.getByText(/No event type set\. Autocomplete isn't available yet/i);
    expect(warning.closest('[role="status"]')).toBeTruthy();
    expect(warning.closest('[role="alert"]')).toBeNull();

    await user.click(screen.getByRole("button", { name: "Edit path" }));
    const manualInput = screen.getByRole("textbox", { name: /edit path manually/i });
    await user.type(manualInput, "$.eventData.orderId");
    expect(screen.getByTestId("current-value")).toHaveTextContent("$.eventData.orderId");
  });

  it("removes the warning once an event type is configured and still allows manual entry", async () => {
    const user = userEvent.setup();
    render(<Harness fetchDataModel={makeFetchDataModel()} />);

    await user.click(screen.getByRole("button", { name: "Select a field" }));
    expect(screen.queryByText(/No event type set\. Autocomplete isn't available yet/i)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Edit path" }));
    const manualInput = screen.getByRole("textbox", { name: /edit path manually/i });
    await user.type(manualInput, "$.eventData.orderId");
    expect(screen.getByTestId("current-value")).toHaveTextContent("$.eventData.orderId");
  });

  it("does not mislabel an event with an unresolved schema as missing", async () => {
    const user = userEvent.setup();
    render(
      <Harness fetchDataModel={makeFetchDataModel()} noDataModel eventTypeCode="ORDER_PLACED" />
    );

    await user.click(screen.getByRole("button", { name: "Select a field" }));
    expect(screen.queryByText(/No event type set/i)).toBeNull();
  });
});

describe("PropertyPicker — happy path search + drill + select (R7)", () => {
  it("keeps the event root in a shallow selected-field breadcrumb", async () => {
    render(<Harness fetchDataModel={makeFetchDataModel()} initialValue="$.eventData.total" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Field: Event Data › Total/ })).toBeInTheDocument();
    });
  });

  it("navigates Event Data > Customer > Address > ZIP Code and commits the path", async () => {
    const user = userEvent.setup();
    const fetchDataModel = makeFetchDataModel();
    render(<Harness fetchDataModel={fetchDataModel} />);

    await user.click(screen.getByRole("button", { name: "Select a field" }));
    await user.click(await screen.findByRole("option", { name: /Event Data/ }));
    await user.click(await screen.findByRole("option", { name: /^Customer/ }));
    await user.click(await screen.findByRole("option", { name: /^Address/ }));
    await user.click(await screen.findByRole("option", { name: /^ZIP Code/ }));

    expect(screen.getByTestId("current-value")).toHaveTextContent(
      "$.eventData.customer.address.zipCode"
    );
    await waitFor(() => {
      expect(reportFieldName).toHaveBeenCalledWith(
        expect.any(String),
        "$.eventData.customer.address.zipCode",
        "ZIP Code"
      );
    });
    // Popover closes and focus returns to the field pill after commit.
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("PropertyPicker — resolved-path footer (U12)", () => {
  it("shows the raw path visibly and announces the full validation sentence via role=status (Codex a11y review)", async () => {
    const user = userEvent.setup();
    const fetchDataModel = makeFetchDataModel();
    render(<Harness fetchDataModel={fetchDataModel} />);

    await user.click(screen.getByRole("button", { name: "Select a field" }));
    await user.click(screen.getByRole("button", { name: "Edit path" }));

    const manualInput = screen.getByRole("textbox", { name: /edit path manually/i });
    await user.type(manualInput, "$.eventData.customer.address.zipCode");

    // The visible footer label is the quiet "RESOLVES TO" micro-label — the
    // full friendly sentence is not repeated as visible body text.
    expect(screen.getByText("Resolves to")).toBeInTheDocument();

    // The full "Valid path — ..." sentence is not silently dropped: it's
    // always present in an accessible role="status" region, even though the
    // visible footer text is just the raw path (Codex review: a `title`
    // attribute alone is not reliably announced by screen readers or touch
    // users, so status must not live there alone).
    await waitFor(() => {
      expect(screen.getByTestId("footer-status")).toHaveTextContent(/valid path/i);
    });
    // The visible path text itself carries no sentence — just the raw path.
    expect(screen.getByTestId("footer-status")).not.toHaveTextContent(
      "$.eventData.customer.address.zipCode"
    );
  });
});

describe("PropertyPicker — current-level search (R7/AE7)", () => {
  it("filters only the current level and restores the full level when cleared", async () => {
    const user = userEvent.setup();
    const fetchDataModel = makeFetchDataModel();
    render(<Harness fetchDataModel={fetchDataModel} />);

    await user.click(screen.getByRole("button", { name: "Select a field" }));
    await user.click(await screen.findByRole("option", { name: /Event Data/ }));

    const search = screen.getByRole("textbox", { name: /search fields/i });
    // `user.type()` drives 4 sequential keystroke events, each an async
    // round-trip through React's act() — under a contended CI runner that
    // repeatedly raced past the synchronous assertions below. The filter
    // itself is a plain synchronous useMemo over `search` state, so a single
    // fireEvent.change commits the full value (and the resulting render) in
    // one act() flush, removing the race instead of trying to out-wait it.
    fireEvent.change(search, { target: { value: "cust" } });

    expect(screen.getByRole("option", { name: /^Customer/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /^Total/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /^Status/ })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getByRole("option", { name: /^Customer/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^Total/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^Status/ })).toBeInTheDocument();
  });

  it("shows an empty-result state for a non-matching search without leaving the level", async () => {
    const user = userEvent.setup();
    const fetchDataModel = makeFetchDataModel();
    render(<Harness fetchDataModel={fetchDataModel} />);

    await user.click(screen.getByRole("button", { name: "Select a field" }));
    await user.click(await screen.findByRole("option", { name: /Event Data/ }));

    const search = screen.getByRole("textbox", { name: /search fields/i });
    // `user.type()` drives 12 sequential keystroke events, each an async
    // round-trip through React's act() — under a contended CI runner that
    // repeatedly raced past even a widened findByText timeout. The filter
    // itself is a plain synchronous useMemo over `search` state, so a single
    // fireEvent.change commits the full value (and the resulting render) in
    // one act() flush, removing the race instead of trying to out-wait it.
    fireEvent.change(search, { target: { value: "zzz-no-match" } });

    expect(screen.getByText(/no fields match your search/i)).toBeInTheDocument();
    expect(screen.getByRole("listbox", { name: /Event Data/ })).toBeInTheDocument();
  });
});

describe("PropertyPicker — loading and navigation", () => {
  it("shows a skeleton while a drilled-into level's children are loading", async () => {
    const user = userEvent.setup();
    let resolveAddress: (() => void) | undefined;
    const fetchDataModel = makeFetchDataModel({
      CUSTOMER_INFO: () =>
        new Promise((resolve) => {
          resolveAddress = () => resolve(MODELS.CUSTOMER_INFO!);
        }),
    });
    render(<Harness fetchDataModel={fetchDataModel} />);

    await user.click(screen.getByRole("button", { name: "Select a field" }));
    await user.click(await screen.findByRole("option", { name: /Event Data/ }));
    await user.click(await screen.findByRole("option", { name: /^Customer/ }));

    expect(document.querySelector('[class*="animate-pulse"]')).toBeTruthy();
    resolveAddress?.();
    expect(await screen.findByRole("option", { name: /^Address/ })).toBeInTheDocument();
  });

  it("lets the user step back up via breadcrumb with focus restored to the drilled-into field", async () => {
    const user = userEvent.setup();
    const fetchDataModel = makeFetchDataModel();
    render(<Harness fetchDataModel={fetchDataModel} />);

    await user.click(screen.getByRole("button", { name: "Select a field" }));
    await user.click(await screen.findByRole("option", { name: /Event Data/ }));
    await user.click(await screen.findByRole("option", { name: /^Customer/ }));
    expect(await screen.findByRole("option", { name: /^Address/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Event Data" }));

    const customerOption = await screen.findByRole("option", { name: /^Customer/ });
    await waitFor(() => expect(customerOption).toHaveFocus());
  });

  it("distinguishes field type icons for text, number, and nested fields", async () => {
    const user = userEvent.setup();
    const fetchDataModel = makeFetchDataModel();
    render(<Harness fetchDataModel={fetchDataModel} />);

    await user.click(screen.getByRole("button", { name: "Select a field" }));
    await user.click(await screen.findByRole("option", { name: /Event Data/ }));

    const customerOption = screen.getByRole("option", { name: /^Customer/ });
    const totalOption = screen.getByRole("option", { name: /^Total/ });
    const statusOption = screen.getByRole("option", { name: /^Status/ });

    expect(
      within(customerOption).getByText("", { selector: "svg.lucide-list-tree" })
    ).toBeInTheDocument();
    expect(within(totalOption).getByText("", { selector: "svg.lucide-hash" })).toBeInTheDocument();
    expect(within(statusOption).getByText("", { selector: "svg.lucide-type" })).toBeInTheDocument();
  });
});

/**
 * Keyboard navigation (Codex review F2/F3): the custom listbox/level
 * accessibility model (R9) had zero test coverage — including the exact
 * risk surface behind F2 (Tab hijacked into the option list). These lock in
 * ArrowDown/ArrowUp/Enter/Escape and confirm Tab is left to native focus
 * traversal.
 */
describe("PropertyPicker — keyboard navigation (R9, Codex review F2/F3)", () => {
  it("ArrowDown from the search box moves focus into the option list", async () => {
    const user = userEvent.setup();
    const fetchDataModel = makeFetchDataModel();
    render(<Harness fetchDataModel={fetchDataModel} />);

    await user.click(screen.getByRole("button", { name: "Select a field" }));
    // Opening the picker auto-focuses the first option via a queued
    // rAF (existing behavior) — let that settle first so it can't race a
    // subsequent click/type into the search box and steal focus back.
    const eventData = await screen.findByRole("option", { name: /Event Data/ });
    await waitFor(() => expect(eventData).toHaveFocus());

    const searchInput = screen.getByRole("textbox", { name: "Search fields at this level" });
    await user.click(searchInput);
    expect(searchInput).toHaveFocus();

    await user.keyboard("{ArrowDown}");

    expect(eventData).toHaveFocus();
  });

  it("ArrowDown/ArrowUp move focus between sibling options, and ArrowUp from the first option returns to the search box", async () => {
    const user = userEvent.setup();
    const fetchDataModel = makeFetchDataModel();
    render(<Harness fetchDataModel={fetchDataModel} />);

    await user.click(screen.getByRole("button", { name: "Select a field" }));
    const eventData = await screen.findByRole("option", { name: /Event Data/ });
    const eventTarget = screen.getByRole("option", { name: /Event Target/ });
    eventData.focus();

    await user.keyboard("{ArrowDown}");
    expect(eventTarget).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(eventData).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("textbox", { name: "Search fields at this level" })).toHaveFocus();
  });

  it("Enter on a non-primitive option drills into the next level", async () => {
    const user = userEvent.setup();
    const fetchDataModel = makeFetchDataModel();
    render(<Harness fetchDataModel={fetchDataModel} />);

    await user.click(screen.getByRole("button", { name: "Select a field" }));
    const eventData = await screen.findByRole("option", { name: /Event Data/ });
    eventData.focus();

    await user.keyboard("{Enter}");

    expect(await screen.findByRole("option", { name: /^Customer/ })).toBeInTheDocument();
  });

  it("Escape closes the popover and returns focus to the field pill", async () => {
    const user = userEvent.setup();
    const fetchDataModel = makeFetchDataModel();
    render(<Harness fetchDataModel={fetchDataModel} />);

    const trigger = screen.getByRole("button", { name: "Select a field" });
    await user.click(trigger);
    const eventData = await screen.findByRole("option", { name: /Event Data/ });
    eventData.focus();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("does not hijack Tab in the search box (Codex review F2 — Tab previously drilled focus into the option list)", async () => {
    const user = userEvent.setup();
    const fetchDataModel = makeFetchDataModel();
    render(<Harness fetchDataModel={fetchDataModel} />);

    await user.click(screen.getByRole("button", { name: "Select a field" }));
    const searchInput = screen.getByRole("textbox", { name: "Search fields at this level" });
    searchInput.focus();

    const tabEvent = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    fireEvent(searchInput, tabEvent);

    // The handler must not treat Tab as a navigation key: it neither calls
    // preventDefault (which would block native focus traversal) nor moves
    // focus itself the way ArrowDown does.
    expect(tabEvent.defaultPrevented).toBe(false);
    expect(searchInput).toHaveFocus();
  });
});

describe("PropertyPicker — async manual escape hatch (R8/KTD8/AE3)", () => {
  it("resolves a path whose intermediate segments were never navigated via the picker", async () => {
    const user = userEvent.setup();
    const fetchDataModel = makeFetchDataModel();
    render(<Harness fetchDataModel={fetchDataModel} />);

    await user.click(screen.getByRole("button", { name: "Select a field" }));
    await user.click(screen.getByRole("button", { name: "Edit path" }));

    const manualInput = screen.getByRole("textbox", { name: /edit path manually/i });
    await user.type(manualInput, "$.eventData.customer.address.zipCode");

    const matches = await screen.findAllByText(/Valid path.*Customer.*Address.*ZIP Code.*string/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("shows the prefix error immediately for a path missing $.", async () => {
    const user = userEvent.setup();
    const fetchDataModel = makeFetchDataModel();
    render(<Harness fetchDataModel={fetchDataModel} />);

    await user.click(screen.getByRole("button", { name: "Select a field" }));
    await user.click(screen.getByRole("button", { name: "Edit path" }));

    const manualInput = screen.getByRole("textbox", { name: /edit path manually/i });
    await user.type(manualInput, "zipCode");

    expect(await screen.findByRole("alert")).toHaveTextContent(/must start with \$\./i);
  });

  it("shows an unresolved error for a genuinely non-existent path", async () => {
    const user = userEvent.setup();
    const fetchDataModel = makeFetchDataModel();
    render(<Harness fetchDataModel={fetchDataModel} />);

    await user.click(screen.getByRole("button", { name: "Select a field" }));
    await user.click(screen.getByRole("button", { name: "Edit path" }));

    const manualInput = screen.getByRole("textbox", { name: /edit path manually/i });
    await user.type(manualInput, "$.eventData.bogus.field");

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be resolved/i);
  });

  it("shows a distinct load-failure state when a segment fetch fails", async () => {
    const user = userEvent.setup();
    const fetchDataModel = makeFetchDataModel({
      ADDRESS_INFO: () => Promise.reject(new Error("network down")),
    });
    render(<Harness fetchDataModel={fetchDataModel} />);

    await user.click(screen.getByRole("button", { name: "Select a field" }));
    await user.click(screen.getByRole("button", { name: "Edit path" }));

    const manualInput = screen.getByRole("textbox", { name: /edit path manually/i });
    await user.type(manualInput, "$.eventData.customer.address.zipCode");

    const failureMatches = await screen.findAllByText(/couldn't load schema fields/i);
    expect(failureMatches.length).toBeGreaterThan(0);
  });
});

describe("PropertyPicker — Save-gate wiring (fix #11)", () => {
  afterEach(() => {
    reportPathError.mockClear();
    reportFieldName.mockClear();
  });

  // Two full-string user.type() runs (24 and 38 chars) plus a clear() and two
  // waitFor cycles is double the async work of this suite's other tests — the
  // default 5000ms budget is tight under a loaded CI runner (observed timeout
  // in CI, passes locally). Give this one test more headroom via the third
  // arg rather than loosening the assertions it's making.
  it("reports an unresolved-but-prefixed path as blocking, and clears it once valid", async () => {
    const user = userEvent.setup();
    const fetchDataModel = makeFetchDataModel();
    render(<Harness fetchDataModel={fetchDataModel} />);

    await user.click(screen.getByRole("button", { name: "Select a field" }));
    await user.click(screen.getByRole("button", { name: "Edit path" }));

    const manualInput = screen.getByRole("textbox", { name: /edit path manually/i });
    await user.type(manualInput, "$.eventData.bogus.field");
    await screen.findByRole("alert");

    // The FOOTER validates the committed `value` (which the manual field writes
    // on every keystroke), so it reports blocking for the unresolved path.
    await waitFor(() => expect(reportPathError).toHaveBeenCalledWith(expect.any(String), true));

    await user.clear(manualInput);
    await user.type(manualInput, "$.eventData.customer.address.zipCode");
    await screen.findAllByText(/Valid path/i);

    await waitFor(() =>
      expect(reportPathError).toHaveBeenLastCalledWith(expect.any(String), false)
    );
  }, 15000);

  it("does not block Save on a load-failure (non-blocking, schema momentarily unavailable)", async () => {
    const user = userEvent.setup();
    const fetchDataModel = makeFetchDataModel({
      ADDRESS_INFO: () => Promise.reject(new Error("network down")),
    });
    render(<Harness fetchDataModel={fetchDataModel} />);

    await user.click(screen.getByRole("button", { name: "Select a field" }));
    await user.click(screen.getByRole("button", { name: "Edit path" }));

    const manualInput = screen.getByRole("textbox", { name: /edit path manually/i });
    await user.type(manualInput, "$.eventData.customer.address.zipCode");
    await screen.findAllByText(/couldn't load schema fields/i);

    // Typing character-by-character transiently reports intermediate,
    // genuinely-unresolved substrings as blocking — only the FINAL settled
    // state (the load-failure) must be non-blocking.
    await waitFor(() =>
      expect(reportPathError).toHaveBeenLastCalledWith(expect.any(String), false)
    );
  });

  it("blocks Save immediately when the committed value changes, before the NEW value's own resolution has landed (adversarial review finding)", async () => {
    const user = userEvent.setup();
    const fetchDataModel = makeFetchDataModel();

    function ChangingValueHarness(): ReactNode {
      const [value, setValue] = useState("$.eventData.total");
      return (
        <ExpressionContextProvider
          dataModelCode="ORDER_PLACED"
          mode="event"
          fetchDataModel={fetchDataModel}
        >
          <PropertyPicker value={value} onSelect={setValue} />
          <button type="button" onClick={() => setValue("$.eventData.bogus")}>
            Change to an invalid path
          </button>
        </ExpressionContextProvider>
      );
    }
    render(<ChangingValueHarness />);

    // Let the initial, valid value settle to non-blocking first.
    await waitFor(() =>
      expect(reportPathError).toHaveBeenLastCalledWith(expect.any(String), false)
    );
    reportPathError.mockClear();
    reportFieldName.mockClear();

    await user.click(screen.getByRole("button", { name: "Change to an invalid path" }));

    // Immediately after the value changes — before the new value's own
    // resolvePath call has had a chance to settle — Save must already be
    // blocked. Without the fix, this synchronously reflected the OLD (valid)
    // value's non-blocking result for the whole async window.
    expect(reportPathError).toHaveBeenCalledWith(expect.any(String), true);
    // The prior path's valid resolution must not be relabeled as the new path
    // while that new path is still resolving.
    expect(reportFieldName).not.toHaveBeenCalledWith(
      expect.any(String),
      "$.eventData.bogus",
      "Total"
    );

    // Once the new value's own resolution actually lands (genuinely
    // unresolved), it stays blocking — same conclusion, but now for the
    // right reason.
    await waitFor(() => expect(reportPathError).toHaveBeenLastCalledWith(expect.any(String), true));
  });
});

describe("PropertyPicker — navigateToValue race guard (adversarial review finding)", () => {
  it("a stale reopen's delayed schema fetch doesn't clobber a fresher navigation's level", async () => {
    const user = userEvent.setup();
    let resolveCustomerInfo: ((model: DataModelLike) => void) | undefined;
    const fetchDataModel = makeFetchDataModel({
      CUSTOMER_INFO: () =>
        new Promise<DataModelLike>((resolve) => {
          resolveCustomerInfo = resolve;
        }),
    });

    function RaceHarness(): ReactNode {
      const [value, setValue] = useState("$.eventData.customer.address.zipCode");
      return (
        <ExpressionContextProvider
          dataModelCode="ORDER_PLACED"
          mode="event"
          fetchDataModel={fetchDataModel}
        >
          <PropertyPicker value={value} onSelect={setValue} />
          <button type="button" onClick={() => setValue("$.eventData.total")}>
            Switch to shallow value
          </button>
        </ExpressionContextProvider>
      );
    }
    render(<RaceHarness />);

    // First open: drilling down to the nested value's own level requires
    // CUSTOMER_INFO's schema, which is deliberately left pending.
    await user.click(screen.getByRole("button", { name: /Select a field|Click to change/ }));
    await waitFor(() => expect(resolveCustomerInfo).toBeDefined());

    // Close without waiting for that fetch, switch to an unrelated shallow
    // value, and reopen — a second, independent navigation with a higher
    // sequence number.
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Switch to shallow value" }));
    await user.click(screen.getByRole("button", { name: /Select a field|Click to change/ }));

    // The second (shallow) navigation needs no await, so "Total" is already
    // showing as a sibling at the Event Data level.
    expect(await screen.findByRole("option", { name: /^Total/ })).toBeInTheDocument();

    // Now let the FIRST (stale) fetch resolve. Without the sequence guard,
    // its setRootSection/setTrail would land now and silently replace the
    // correct level with the first navigation's (now-superseded) target.
    resolveCustomerInfo!(MODELS.CUSTOMER_INFO!);
    await waitFor(() => {
      expect(screen.getByRole("option", { name: /^Total/ })).toBeInTheDocument();
    });
  });
});

describe("PropertyPicker — navigateToValue coverage (adversarial review finding)", () => {
  it("falls back to the root level when a middle segment doesn't exist in the schema (stale/mismatched value)", async () => {
    const user = userEvent.setup();
    const fetchDataModel = makeFetchDataModel();
    render(
      <Harness fetchDataModel={fetchDataModel} initialValue="$.eventData.customer.bogus.zipCode" />
    );

    await user.click(screen.getByRole("button", { name: /select a field|click to change/i }));

    // "bogus" isn't a real field under Customer — the picker can't drill to
    // it, so it must show the root section list rather than a stuck/empty
    // level.
    expect(await screen.findByRole("option", { name: /Event Data/ })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: /Event Target/ })).toBeInTheDocument();
  });

  it("drills to the customer root with no eventData/eventTarget prefix in customer mode", async () => {
    const user = userEvent.setup();
    const fetchDataModel = makeFetchDataModel();

    function CustomerHarness(): ReactNode {
      const [value, setValue] = useState("$.tier");
      return (
        <ExpressionContextProvider
          dataModelCode="customer"
          mode="customer"
          fetchDataModel={fetchDataModel}
        >
          <PropertyPicker value={value} onSelect={setValue} />
        </ExpressionContextProvider>
      );
    }
    render(<CustomerHarness />);

    await user.click(screen.getByRole("button", { name: /select a field|click to change/i }));

    // A single-segment customer-mode path has no parent to drill into — it
    // should land directly at the customer root's own level (showing "Tier"
    // as a sibling), not error or hang.
    expect(await screen.findByRole("option", { name: /^Tier/ })).toBeInTheDocument();
  });
});
