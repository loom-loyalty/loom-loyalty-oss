/**
 * LedgerHistorySheet — link back to the originating event (R2).
 *
 * Unlike the event→ledger direction, there is no absence question here: an
 * entry's `referenceId` IS its originating event, straight off the wire, so the
 * event always exists. The only uncertainty is whether it has been *loaded* —
 * the events query is page-capped, and linking to an unloaded event would open
 * an empty sheet. So the ID always renders; only its clickability is gated.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LedgerHistorySheet } from "../ledger-history-sheet";
import type { CurrencyBalance, LedgerEntry } from "../types";

const currency: CurrencyBalance = {
  currencyCode: "POINTS",
  currencyName: "Points",
  decimalPlaces: 0,
  earned: 100,
  pending: 0,
  posted: 100,
  debited: 0,
  available: 100,
  expired: 0,
  expiringByDate: [],
  pendingByDate: [],
};

const LOADED_EVENT_ID = "evt_aaaabbbbccccddddeeeeffff00001111";
const UNLOADED_EVENT_ID = "evt_99998888777766665555444433332222";

function entry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    entryId: "ple_1111222233334444555566667777888",
    currencyCode: "POINTS",
    currencyName: "Points",
    amount: 100,
    type: "CREDIT",
    eventDateTime: "2026-01-01T00:00:00Z",
    description: "Welcome bonus",
    referenceId: LOADED_EVENT_ID,
    status: "POSTED",
    ...overrides,
  };
}

function renderSheet(props: Partial<React.ComponentProps<typeof LedgerHistorySheet>> = {}) {
  return render(
    <LedgerHistorySheet
      open
      onOpenChange={vi.fn()}
      currencies={[currency]}
      entries={[entry()]}
      totalEntries={1}
      page={1}
      pageSize={10}
      onPageChange={vi.fn()}
      selectedCurrencyCode="POINTS"
      onCurrencyChange={vi.fn()}
      {...props}
    />
  );
}

describe("LedgerHistorySheet — originating event link", () => {
  it("links back to the originating event and reports its full ID on click", async () => {
    const onEventClick = vi.fn();
    renderSheet({ onEventClick, loadedEventIds: new Set([LOADED_EVENT_ID]) });

    const link = screen.getByRole("button", { name: `View event ${LOADED_EVENT_ID}` });
    await userEvent.setup().click(link);

    expect(onEventClick).toHaveBeenCalledWith(LOADED_EVENT_ID);
  });

  it("shows the event ID as plain text when that event is not among the loaded ones", () => {
    renderSheet({
      entries: [entry({ referenceId: UNLOADED_EVENT_ID })],
      onEventClick: vi.fn(),
      loadedEventIds: new Set([LOADED_EVENT_ID]),
    });

    // Still shown — the event genuinely exists — but not clickable, because
    // opening it would render an empty detail sheet.
    expect(screen.queryByRole("button", { name: /View event/ })).not.toBeInTheDocument();
    expect(screen.getByText(/^evt_9999/)).toBeInTheDocument();
  });

  it("renders a dash for an entry with no originating event ID", () => {
    renderSheet({
      entries: [entry({ referenceId: "" })],
      onEventClick: vi.fn(),
      loadedEventIds: new Set([LOADED_EVENT_ID]),
    });

    expect(screen.queryByRole("button", { name: /View event/ })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Event" })).toBeInTheDocument();
  });

  it("degrades to plain text when no click handler is provided at all", () => {
    renderSheet({ loadedEventIds: new Set([LOADED_EVENT_ID]) });

    expect(screen.queryByRole("button", { name: /View event/ })).not.toBeInTheDocument();
    expect(screen.getByText(/^evt_aaaa/)).toBeInTheDocument();
  });
});
