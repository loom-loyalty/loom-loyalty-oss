import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CustomerDetail } from "../customer-view";
import type { CustomerData, CustomerEvent, LedgerEntry } from "../types";

const LINKED_EVENT_ID = "evt_aaaabbbbccccddddeeeeffff00001111";
const UNLINKED_EVENT_ID = "evt_11112222333344445555666677778888";
const UNLOADED_EVENT_ID = "evt_99998888777766665555444433332222";
const DECOY_EVENT_ID = "evt_ddddeeeeffff0000111122223333aaaa";

const linkedEvent: CustomerEvent = {
  eventId: LINKED_EVENT_ID,
  eventType: "customEvent",
  eventDateTime: "2026-01-01T12:00:00Z",
  title: "Welcome event",
  description: "Customer received a welcome bonus.",
};

const unlinkedEvent: CustomerEvent = {
  eventId: UNLINKED_EVENT_ID,
  eventType: "customEvent",
  eventDateTime: "2026-01-01T11:00:00Z",
  title: "Profile updated",
  description: "Customer updated their profile.",
};

const linkedLedgerEntry: LedgerEntry = {
  entryId: "ple_aaaabbbbccccddddeeeeffff00001111",
  currencyCode: "POINTS",
  currencyName: "Points",
  amount: 100,
  type: "CREDIT",
  eventDateTime: "2026-01-01T12:00:00Z",
  description: "Welcome bonus",
  referenceId: LINKED_EVENT_ID,
  status: "POSTED",
};

// Same timestamp and adjacent array position as linkedLedgerEntry, but a
// different referenceId — a join keyed by anything other than referenceId
// (array order, timestamp) would resolve to this entry instead.
const distractorLedgerEntry: LedgerEntry = {
  entryId: "ple_ccccddddeeeeffff000011112222aaaa",
  currencyCode: "POINTS",
  currencyName: "Points",
  amount: 50,
  type: "CREDIT",
  eventDateTime: "2026-01-01T12:00:00Z",
  description: "Unrelated entry",
  referenceId: DECOY_EVENT_ID,
  status: "POSTED",
};

function createCustomerData({
  events = [linkedEvent, unlinkedEvent],
  ledger = [distractorLedgerEntry, linkedLedgerEntry],
}: Partial<Pick<CustomerData, "events" | "ledger">> = {}): CustomerData {
  return {
    customer: {
      customerId: "cus_aaaabbbbccccddddeeeeffff00001111",
      identity: { firstName: "Avery", lastName: "Stone" },
      statusCode: "ACTIVE",
      statusName: "Active",
      fraudStatusCode: "CLEAR",
      enrollmentChannel: "WEB",
      enrollmentDateTime: "2026-01-01T10:00:00Z",
      createdAt: "2026-01-01T10:00:00Z",
    },
    emails: [],
    phones: [],
    addresses: [],
    programs: [],
    tiers: [],
    badges: [],
    currencies: [
      {
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
      },
    ],
    ledger,
    segments: [],
    events,
    preferences: [],
    identifiers: [],
    coupons: [],
    tags: [],
  };
}

async function openTimelineEvent(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(screen.getByRole("button", { name: new RegExp(title) }));
}

async function openLedgerHistory(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /View All/ }));
}

describe("CustomerDetail — event and ledger links", () => {
  it("passes the event data loading state through to the selected event sheet", async () => {
    const user = userEvent.setup();
    render(<CustomerDetail data={createCustomerData()} eventDataLoading />);

    await openTimelineEvent(user, linkedEvent.title);
    await user.click(screen.getByRole("tab", { name: "Event Data" }));

    const panel = document.getElementById("tabpanel-eventData");
    expect(panel).not.toBeNull();
    expect(panel!.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it("merges on-demand event data into the selected timeline event", async () => {
    const user = userEvent.setup();
    render(
      <CustomerDetail
        data={createCustomerData()}
        selectedEventData={{ eligibleAmount: { amount: 15, currencyTypeCode: "USD" } }}
      />
    );

    await openTimelineEvent(user, linkedEvent.title);

    expect(screen.getByRole("tab", { name: "Event Data" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Event Data" }));
    expect(screen.getByText(/"currencyTypeCode": "USD"/)).toBeInTheDocument();
  });

  it("resolves the selected event's matching ledger entry and surfaces no entry for an unmatched event", async () => {
    const onSelectedEventChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CustomerDetail
        data={createCustomerData()}
        ledgerComplete
        onSelectedEventChange={onSelectedEventChange}
      />
    );

    await openTimelineEvent(user, linkedEvent.title);

    expect(onSelectedEventChange).toHaveBeenCalledWith(LINKED_EVENT_ID);
    expect(
      screen.getByRole("button", { name: `View ledger entry ${linkedLedgerEntry.entryId}` })
    ).toBeInTheDocument();
    // Same eventDateTime and adjacent array position as the expected entry —
    // must not be what the join resolves to.
    expect(
      screen.queryByRole("button", { name: `View ledger entry ${distractorLedgerEntry.entryId}` })
    ).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    await openTimelineEvent(user, unlinkedEvent.title);

    expect(onSelectedEventChange).toHaveBeenLastCalledWith(UNLINKED_EVENT_ID);
    expect(screen.queryByRole("button", { name: /View ledger entry/ })).not.toBeInTheDocument();
    expect(screen.getByText("No effect recorded")).toBeInTheDocument();
  });

  it("opens ledger history and dismisses event detail when following an event's ledger entry", async () => {
    const user = userEvent.setup();
    render(<CustomerDetail data={createCustomerData()} ledgerComplete />);

    await openTimelineEvent(user, linkedEvent.title);
    await user.click(
      screen.getByRole("button", { name: `View ledger entry ${linkedLedgerEntry.entryId}` })
    );

    expect(screen.getByRole("dialog", { name: "Transaction History" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: linkedEvent.title })).not.toBeInTheDocument();
  });

  it("opens a loaded ledger entry's event and dismisses ledger history", async () => {
    const user = userEvent.setup();
    render(<CustomerDetail data={createCustomerData()} ledgerComplete />);

    await openLedgerHistory(user);
    await user.click(screen.getByRole("button", { name: `View event ${LINKED_EVENT_ID}` }));

    expect(screen.getByRole("dialog", { name: linkedEvent.title })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Transaction History" })).not.toBeInTheDocument();
  });

  it("does not navigate when a ledger entry references an event outside the loaded event set", async () => {
    const user = userEvent.setup();
    const unloadedLedgerEntry: LedgerEntry = {
      ...linkedLedgerEntry,
      entryId: "ple_99998888777766665555444433332222",
      referenceId: UNLOADED_EVENT_ID,
    };
    render(
      <CustomerDetail
        data={createCustomerData({ events: [linkedEvent], ledger: [unloadedLedgerEntry] })}
        ledgerComplete
      />
    );

    await openLedgerHistory(user);

    expect(
      screen.queryByRole("button", { name: `View event ${UNLOADED_EVENT_ID}` })
    ).not.toBeInTheDocument();
    await user.click(screen.getByText(`${UNLOADED_EVENT_ID.slice(0, 8)}…`));

    expect(screen.getByRole("dialog", { name: "Transaction History" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: linkedEvent.title })).not.toBeInTheDocument();
  });
});

describe("CustomerDetail — program referrals", () => {
  it("shows each membership's referral line and wires generate and referrer links", async () => {
    const user = userEvent.setup();
    const onGenerateReferralCode = vi.fn();
    const onViewCustomer = vi.fn();
    const data = createCustomerData();
    data.programs = [
      {
        customerProgramId: "cpr_1",
        programId: "prg_1",
        programCode: "coffee",
        programName: "Coffee Club",
        registrationDate: "2026-10-01",
        status: "ACTIVE",
        referredByCustomerId: "cus_referrer000000000000000000000",
        referralCount: 0,
      },
    ];
    render(
      <CustomerDetail
        data={data}
        onGenerateReferralCode={onGenerateReferralCode}
        onViewCustomer={onViewCustomer}
      />
    );

    await user.click(screen.getByRole("tab", { name: "Membership" }));
    await user.click(
      screen.getByRole("button", { name: "Generate referral code for Coffee Club" })
    );
    expect(onGenerateReferralCode).toHaveBeenCalledWith(data.programs[0]);

    await user.click(
      screen.getByRole("button", { name: "View customer cus_referrer000000000000000000000" })
    );
    expect(onViewCustomer).toHaveBeenCalledWith("cus_referrer000000000000000000000");
  });
});
