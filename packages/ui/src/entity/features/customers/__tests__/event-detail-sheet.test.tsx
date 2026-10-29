/**
 * EventDetailSheet — Actions tab "No effect recorded" behavior (R3 / AE2).
 *
 * The Actions tab must always render (never silently disappear), and must
 * distinguish three states:
 *  - loading:  skeleton, never the "No effect recorded" badge
 *  - empty (or field entirely absent — real-world mock/API data omits
 *    `eventActions` for events with no actions, it doesn't send `[]`):
 *    the "No effect recorded" badge
 *  - populated: the existing actions list, unchanged
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { UIFieldConfig } from "@loom-loyalty/schema";
import { EventDetailSheet } from "../event-detail-sheet";
import type { CustomerEvent, LedgerEntry } from "../types";

const baseEvent: CustomerEvent = {
  eventId: "evt-1",
  eventType: "customEvent",
  eventDateTime: "2026-01-01T00:00:00Z",
  title: "Test Event",
  description: "A test event",
};

const matchingLedgerEntry: LedgerEntry = {
  entryId: "ple_aaaabbbbccccddddeeeeffff00001111",
  currencyCode: "POINTS",
  currencyName: "Points",
  amount: 100,
  type: "CREDIT",
  eventDateTime: "2026-01-01T00:00:00Z",
  description: "Welcome bonus",
  referenceId: baseEvent.eventId,
  status: "POSTED",
};

const eligibleAmountField: UIFieldConfig = {
  name: "eligibleAmount",
  label: "Eligible amount",
  widget: "json",
  displayFormat: "json",
  showInList: false,
  showInDetail: true,
  showInCreate: false,
  showInEdit: false,
};

async function openActionsTab() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name: /Actions/ }));
  return user;
}

describe("EventDetailSheet — Actions tab", () => {
  it("always shows an Actions tab, even with no eventActions and not loading", () => {
    render(
      <EventDetailSheet event={{ ...baseEvent, eventActions: [] }} open onOpenChange={vi.fn()} />
    );
    expect(screen.getByRole("tab", { name: /Actions/ })).toBeInTheDocument();
  });

  it("shows the 'No effect recorded' badge when eventActions resolved empty", async () => {
    render(
      <EventDetailSheet event={{ ...baseEvent, eventActions: [] }} open onOpenChange={vi.fn()} />
    );
    await openActionsTab();

    expect(screen.getByText("No effect recorded")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: /No effect recorded/ })).toBeInTheDocument();
  });

  it("shows the 'No effect recorded' badge when eventActions is entirely absent (not loading)", async () => {
    // Real-world case: apps/hub's mock data and API adapter never set
    // `eventActions` at all for events with no actions (it's `?? undefined`,
    // not `?? []`). `baseEvent` has no `eventActions` key at all — this must
    // be treated the same as a resolved empty array, otherwise the actual
    // production bug this unit fixes goes unfixed.
    render(<EventDetailSheet event={baseEvent} open onOpenChange={vi.fn()} />);
    await openActionsTab();

    expect(screen.getByText("No effect recorded")).toBeInTheDocument();
  });

  it("shows a loading skeleton — NOT the badge — while actions are still loading", async () => {
    render(
      <EventDetailSheet
        event={{ ...baseEvent, eventActions: [] }}
        open
        onOpenChange={vi.fn()}
        actionsLoading
      />
    );
    await openActionsTab();

    // The dishonest-flash case this guards against: badge must not appear
    // even though eventActions is (already, misleadingly) an empty array.
    expect(screen.queryByText("No effect recorded")).not.toBeInTheDocument();
    expect(screen.queryByText(/didn't trigger any actions/)).not.toBeInTheDocument();

    // And it's not simply blank — a skeleton placeholder is actually present.
    const panel = document.getElementById("tabpanel-actions");
    expect(panel).not.toBeNull();
    expect(panel!.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it("shows the existing actions list, unchanged, when eventActions is populated", async () => {
    render(
      <EventDetailSheet
        event={{
          ...baseEvent,
          eventActions: [
            {
              rank: 1,
              eventRuleId: "rule-1",
              eventRuleName: "Issue Welcome Points",
              actionType: "issueProgramCurrency",
            },
          ],
        }}
        open
        onOpenChange={vi.fn()}
      />
    );
    const user = await openActionsTab();

    expect(screen.queryByText("No effect recorded")).not.toBeInTheDocument();

    // Actions are grouped under a collapsible header (closed by default) —
    // expand it to confirm the existing ActionsPanel content still renders.
    const groupTrigger = screen.getByRole("button", { name: /Issue Currency/ });
    await user.click(groupTrigger);
    expect(screen.getByText("Issue Welcome Points")).toBeInTheDocument();
  });

  it("shows the item count pill only once actions are actually resolved and populated", () => {
    render(
      <EventDetailSheet
        event={{
          ...baseEvent,
          eventActions: [
            {
              rank: 1,
              eventRuleId: "rule-1",
              eventRuleName: "A",
              actionType: "issueProgramCurrency",
            },
          ],
        }}
        open
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText("1 items")).toBeInTheDocument();
  });

  it("does not show an item count pill for a resolved-empty or absent eventActions", () => {
    const { rerender } = render(
      <EventDetailSheet event={{ ...baseEvent, eventActions: [] }} open onOpenChange={vi.fn()} />
    );
    expect(screen.queryByLabelText(/items/)).not.toBeInTheDocument();

    rerender(<EventDetailSheet event={baseEvent} open onOpenChange={vi.fn()} />);
    expect(screen.queryByLabelText(/items/)).not.toBeInTheDocument();
  });

  it.each([
    ["a confirmed absence", true],
    ["an unsearched remainder", false],
  ])("keeps the Actions tab independent of the ledger row showing %s", async (_label, complete) => {
    render(
      <EventDetailSheet
        event={{ ...baseEvent, eventActions: [] }}
        open
        onOpenChange={vi.fn()}
        ledgerComplete={complete}
      />
    );
    await openActionsTab();

    // The Actions tab's own "No effect recorded" is about actions, not the
    // ledger. Switching tabs unmounts the Overview panel, so the two states
    // can never be confused for one another in the DOM.
    expect(screen.getByText(/didn't trigger any actions/)).toBeInTheDocument();
    expect(screen.queryByText(/didn't produce a ledger entry/)).not.toBeInTheDocument();
  });

  it("does not show an item count on the Actions tab while loading", () => {
    render(
      <EventDetailSheet
        event={{ ...baseEvent, eventActions: [] }}
        open
        onOpenChange={vi.fn()}
        actionsLoading
      />
    );
    // GradientTabs renders the count pill with an `"N items"` aria-label
    // only when `count !== undefined`. While loading, count must be
    // undefined so no (potentially stale/misleading) number is shown.
    expect(screen.queryByLabelText(/items/)).not.toBeInTheDocument();
  });
});

/**
 * R1 — the event's link to the ledger entry it produced.
 *
 * The join reads a page-capped ledger, so a miss has two very different
 * meanings. Only `ledgerComplete` licenses the confident one; conflating them
 * is the exact dishonesty this feature exists to remove.
 */
describe("EventDetailSheet — ledger entry link", () => {
  it("links to the matching ledger entry and reports its full ID on click", async () => {
    const onLedgerEntryClick = vi.fn();
    render(
      <EventDetailSheet
        event={baseEvent}
        open
        onOpenChange={vi.fn()}
        ledgerEntry={matchingLedgerEntry}
        ledgerComplete
        onLedgerEntryClick={onLedgerEntryClick}
      />
    );

    const link = screen.getByRole("button", {
      name: `View ledger entry ${matchingLedgerEntry.entryId}`,
    });
    await userEvent.setup().click(link);

    expect(onLedgerEntryClick).toHaveBeenCalledWith(matchingLedgerEntry.entryId);
    expect(screen.queryByText("No effect recorded")).not.toBeInTheDocument();
  });

  it("renders the matched entry as plain text when no click handler is wired", () => {
    render(
      <EventDetailSheet
        event={baseEvent}
        open
        onOpenChange={vi.fn()}
        ledgerEntry={matchingLedgerEntry}
        ledgerComplete
      />
    );

    expect(screen.queryByRole("button", { name: /View ledger entry/ })).not.toBeInTheDocument();
    expect(screen.getByText(/^ple_aaaa/)).toBeInTheDocument();
  });

  it("claims a confirmed absence only when the whole ledger was searched", () => {
    render(
      <EventDetailSheet
        event={baseEvent}
        open
        onOpenChange={vi.fn()}
        ledgerEntry={null}
        ledgerComplete
        onLedgerEntryClick={vi.fn()}
      />
    );

    expect(screen.getByText("No effect recorded")).toBeInTheDocument();
    expect(screen.getByText(/didn't produce a ledger entry/)).toBeInTheDocument();
  });

  it("does NOT claim a confirmed absence when the ledger was only partly fetched", () => {
    render(
      <EventDetailSheet
        event={baseEvent}
        open
        onOpenChange={vi.fn()}
        ledgerEntry={null}
        ledgerComplete={false}
        onLedgerEntryClick={vi.fn()}
      />
    );

    // The whole point: a match could exist beyond the fetched pages, so the
    // confident badge must not appear — the copy says what is actually known.
    expect(screen.queryByText("No effect recorded")).not.toBeInTheDocument();
    expect(screen.queryByText(/didn't produce a ledger entry/)).not.toBeInTheDocument();
    expect(screen.getByText(/Not found in loaded history/)).toBeInTheDocument();
  });

  it("treats an unknown completeness state as not-yet-searched", () => {
    // `ledgerComplete` is absent while the ledger query is still in flight.
    render(<EventDetailSheet event={baseEvent} open onOpenChange={vi.fn()} />);

    expect(screen.queryByText("No effect recorded")).not.toBeInTheDocument();
    expect(screen.getByText(/Not found in loaded history/)).toBeInTheDocument();
  });
});

describe("EventDetailSheet — Event Data tab", () => {
  const eventWithData: CustomerEvent = {
    ...baseEvent,
    eventData: { eligibleAmount: { amount: 15, currencyTypeCode: "USD" } },
  };

  it("uses declared matching fields instead of the raw event-data panel", async () => {
    render(
      <EventDetailSheet
        event={eventWithData}
        open
        onOpenChange={vi.fn()}
        eventDataFields={[eligibleAmountField]}
      />
    );

    await userEvent.setup().click(screen.getByRole("tab", { name: "Event Data" }));

    expect(screen.getByText("Eligible amount")).toBeInTheDocument();
    expect(screen.getByText(/"currencyTypeCode": "USD"/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Copy Event data/ })).not.toBeInTheDocument();
  });

  it("falls back to raw JSON when model resolution is unavailable", async () => {
    render(<EventDetailSheet event={eventWithData} open onOpenChange={vi.fn()} />);

    await userEvent.setup().click(screen.getByRole("tab", { name: "Event Data" }));

    expect(screen.getByRole("button", { name: /Copy Event data/ })).toBeInTheDocument();
  });

  it("shows the Event Data tab and a loading skeleton while its payload is fetching", async () => {
    render(<EventDetailSheet event={baseEvent} open onOpenChange={vi.fn()} eventDataLoading />);

    await userEvent.setup().click(screen.getByRole("tab", { name: "Event Data" }));

    const panel = document.getElementById("tabpanel-eventData");
    expect(panel).not.toBeNull();
    expect(panel!.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it("shows an inline error when the event data fetch fails", async () => {
    render(<EventDetailSheet event={baseEvent} open onOpenChange={vi.fn()} eventDataError />);

    await userEvent.setup().click(screen.getByRole("tab", { name: "Event Data" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load event data.");
  });

  it("hides Event Data when a resolved model has no matching fields", () => {
    render(
      <EventDetailSheet event={eventWithData} open onOpenChange={vi.fn()} eventDataFields={[]} />
    );

    expect(screen.queryByRole("tab", { name: "Event Data" })).not.toBeInTheDocument();
  });
});
