/**
 * Customer Types — Unit Tests
 *
 * Tests for helper functions and constants exported from types.ts.
 */

import type { Customer as SDKCustomer } from "@loom-loyalty/sdk";
import { describe, expect, it } from "vitest";
import {
  CUSTOMER_STANDARD_FIELDS,
  detectActionType,
  formatCurrencyValue,
  getActiveTier,
  getCustomerInitials,
  getCustomerName,
  getEventActionBadgeLabel,
  getPrimaryEmail,
  getPrimaryPhone,
  getSDKCustomerName,
  getSDKPrimaryEmail,
  getSDKPrimaryPhone,
  indexLedgerByEventId,
  type ContactEmail,
  type ContactPhone,
  type Customer,
  type CustomerEvent,
  type CustomerEventAction,
  type CustomerTierEntry,
  type LedgerEntry,
} from "../types.js";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    customerId: "cust_abc123",
    statusCode: "ACTIVE",
    statusName: "Active",
    fraudStatusCode: "CLEAR",
    enrollmentChannel: "WEB",
    enrollmentDateTime: "2025-01-01T00:00:00Z",
    createdAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeEmail(overrides: Partial<ContactEmail> = {}): ContactEmail {
  return {
    id: "email-1",
    emailAddress: "test@example.com",
    typeCode: "PERSONAL",
    typeName: "Personal",
    primary: false,
    status: "ACTIVE",
    verified: true,
    ...overrides,
  };
}

function makePhone(overrides: Partial<ContactPhone> = {}): ContactPhone {
  return {
    id: "phone-1",
    number: "+15551234567",
    typeCode: "MOBILE",
    typeName: "Mobile",
    primary: false,
    status: "ACTIVE",
    ...overrides,
  };
}

function makeTier(overrides: Partial<CustomerTierEntry> = {}): CustomerTierEntry {
  return {
    tierId: "tier-1",
    tierCode: "gold",
    tierName: "Gold",
    tierRank: 2,
    startDateTime: "2025-01-01T00:00:00Z",
    active: false,
    lifetimeTier: false,
    trialTier: false,
    issuedDateTime: "2025-01-01T00:00:00Z",
    cancelled: false,
    ...overrides,
  };
}

// ─── getCustomerName ─────────────────────────────────────────────────────────

describe("getCustomerName", () => {
  it("returns full name for individual customer", () => {
    const customer = makeCustomer({
      identity: { firstName: "Jane", lastName: "Doe" },
    });
    expect(getCustomerName(customer)).toBe("Jane Doe");
  });

  it("includes middle name when present", () => {
    const customer = makeCustomer({
      identity: { firstName: "Jane", middleName: "Marie", lastName: "Doe" },
    });
    expect(getCustomerName(customer)).toBe("Jane Marie Doe");
  });

  it("returns company name for corporate customer", () => {
    const customer = makeCustomer({
      corporateIdentity: { companyName: "Acme Inc" },
    });
    expect(getCustomerName(customer)).toBe("Acme Inc");
  });

  it('returns "Unknown" when no identity is set', () => {
    const customer = makeCustomer();
    expect(getCustomerName(customer)).toBe("Unknown");
  });

  it("prefers individual identity over corporate when both are present", () => {
    const customer = makeCustomer({
      identity: { firstName: "Jane", lastName: "Doe" },
      corporateIdentity: { companyName: "Acme Inc" },
    });
    expect(getCustomerName(customer)).toBe("Jane Doe");
  });
});

// ─── getCustomerInitials ─────────────────────────────────────────────────────

describe("getCustomerInitials", () => {
  it("returns first+last initials for individual customer", () => {
    const customer = makeCustomer({
      identity: { firstName: "Jane", lastName: "Doe" },
    });
    expect(getCustomerInitials(customer)).toBe("JD");
  });

  it("uppercases the initials", () => {
    const customer = makeCustomer({
      identity: { firstName: "jane", lastName: "doe" },
    });
    expect(getCustomerInitials(customer)).toBe("JD");
  });

  it("returns first two chars of company name for corporate customer", () => {
    const customer = makeCustomer({
      corporateIdentity: { companyName: "Acme Inc" },
    });
    expect(getCustomerInitials(customer)).toBe("AC");
  });

  it("uppercases corporate initials", () => {
    const customer = makeCustomer({
      corporateIdentity: { companyName: "acme" },
    });
    expect(getCustomerInitials(customer)).toBe("AC");
  });

  it('returns "??" when no identity is set', () => {
    const customer = makeCustomer();
    expect(getCustomerInitials(customer)).toBe("??");
  });
});

// ─── getPrimaryEmail ─────────────────────────────────────────────────────────

describe("getPrimaryEmail", () => {
  it("returns undefined for empty array", () => {
    expect(getPrimaryEmail([])).toBeUndefined();
  });

  it("returns the primary email when one exists", () => {
    const emails = [
      makeEmail({ id: "e1", emailAddress: "secondary@test.com", primary: false }),
      makeEmail({ id: "e2", emailAddress: "primary@test.com", primary: true }),
    ];
    expect(getPrimaryEmail(emails)?.emailAddress).toBe("primary@test.com");
  });

  it("falls back to the first email when none is primary", () => {
    const emails = [
      makeEmail({ id: "e1", emailAddress: "first@test.com", primary: false }),
      makeEmail({ id: "e2", emailAddress: "second@test.com", primary: false }),
    ];
    expect(getPrimaryEmail(emails)?.emailAddress).toBe("first@test.com");
  });
});

// ─── getPrimaryPhone ─────────────────────────────────────────────────────────

describe("getPrimaryPhone", () => {
  it("returns undefined for empty array", () => {
    expect(getPrimaryPhone([])).toBeUndefined();
  });

  it("returns the primary phone when one exists", () => {
    const phones = [
      makePhone({ id: "p1", number: "+15550001111", primary: false }),
      makePhone({ id: "p2", number: "+15550002222", primary: true }),
    ];
    expect(getPrimaryPhone(phones)?.number).toBe("+15550002222");
  });

  it("falls back to the first phone when none is primary", () => {
    const phones = [
      makePhone({ id: "p1", number: "+15550001111", primary: false }),
      makePhone({ id: "p2", number: "+15550002222", primary: false }),
    ];
    expect(getPrimaryPhone(phones)?.number).toBe("+15550001111");
  });
});

// ─── getActiveTier ───────────────────────────────────────────────────────────

describe("getActiveTier", () => {
  it("returns undefined when no tiers are provided", () => {
    expect(getActiveTier([])).toBeUndefined();
  });

  it("returns undefined when all tiers are inactive", () => {
    const tiers = [
      makeTier({ active: false, cancelled: false }),
      makeTier({ tierId: "t2", active: false, cancelled: false }),
    ];
    expect(getActiveTier(tiers)).toBeUndefined();
  });

  it("returns undefined when active tier is cancelled", () => {
    const tiers = [makeTier({ active: true, cancelled: true })];
    expect(getActiveTier(tiers)).toBeUndefined();
  });

  it("returns the active non-cancelled tier", () => {
    const tiers = [
      makeTier({ tierId: "t1", tierName: "Silver", active: false, cancelled: false }),
      makeTier({ tierId: "t2", tierName: "Gold", active: true, cancelled: false }),
      makeTier({ tierId: "t3", tierName: "Platinum", active: true, cancelled: true }),
    ];
    const result = getActiveTier(tiers);
    expect(result?.tierName).toBe("Gold");
  });
});

// ─── formatCurrencyValue ─────────────────────────────────────────────────────

describe("formatCurrencyValue", () => {
  it("formats with zero decimal places", () => {
    expect(formatCurrencyValue(1000, 0)).toBe("1,000");
  });

  it("formats with two decimal places", () => {
    expect(formatCurrencyValue(1234.5, 2)).toBe("1,234.50");
  });

  it("prepends symbol when provided", () => {
    expect(formatCurrencyValue(500, 2, "$")).toBe("$500.00");
  });

  it("works without symbol", () => {
    expect(formatCurrencyValue(500, 2)).toBe("500.00");
  });

  it("formats zero correctly", () => {
    expect(formatCurrencyValue(0, 2, "$")).toBe("$0.00");
  });

  it("handles large numbers with commas", () => {
    expect(formatCurrencyValue(1234567, 0)).toBe("1,234,567");
  });
});

// ─── getSDKCustomerName ──────────────────────────────────────────────────────

describe("getSDKCustomerName", () => {
  it("returns full name for individual SDK customer", () => {
    const customer = {
      identity: { firstName: "Alice", lastName: "Smith" },
    } as SDKCustomer;
    expect(getSDKCustomerName(customer)).toBe("Alice Smith");
  });

  it("includes middle name for SDK customer", () => {
    const customer = {
      identity: { firstName: "Alice", middleName: "B", lastName: "Smith" },
    } as SDKCustomer;
    expect(getSDKCustomerName(customer)).toBe("Alice B Smith");
  });

  it("returns company name for corporate SDK customer", () => {
    const customer = {
      corporateIdentity: { companyName: "Big Corp" },
    } as SDKCustomer;
    expect(getSDKCustomerName(customer)).toBe("Big Corp");
  });

  it('returns "Unknown" when SDK customer has no identity', () => {
    const customer = {} as SDKCustomer;
    expect(getSDKCustomerName(customer)).toBe("Unknown");
  });
});

// ─── getSDKPrimaryEmail ──────────────────────────────────────────────────────

describe("getSDKPrimaryEmail", () => {
  it("returns undefined for undefined input", () => {
    expect(getSDKPrimaryEmail(undefined)).toBeUndefined();
  });

  it("returns undefined for empty array", () => {
    expect(getSDKPrimaryEmail([])).toBeUndefined();
  });

  it("returns primary email when one exists", () => {
    const emails = [
      { emailAddress: "a@test.com", primary: false },
      { emailAddress: "b@test.com", primary: true },
    ];
    expect(getSDKPrimaryEmail(emails)?.emailAddress).toBe("b@test.com");
  });

  it("falls back to first email when none is primary", () => {
    const emails = [
      { emailAddress: "a@test.com", primary: false },
      { emailAddress: "b@test.com", primary: false },
    ];
    expect(getSDKPrimaryEmail(emails)?.emailAddress).toBe("a@test.com");
  });
});

// ─── getSDKPrimaryPhone ──────────────────────────────────────────────────────

describe("getSDKPrimaryPhone", () => {
  it("returns undefined for undefined input", () => {
    expect(getSDKPrimaryPhone(undefined)).toBeUndefined();
  });

  it("returns undefined for empty array", () => {
    expect(getSDKPrimaryPhone([])).toBeUndefined();
  });

  it("returns primary phone when one exists", () => {
    const phones = [
      { number: "+1111", primary: false },
      { number: "+2222", primary: true },
    ];
    expect(getSDKPrimaryPhone(phones)?.number).toBe("+2222");
  });

  it("falls back to first phone when none is primary", () => {
    const phones = [
      { number: "+1111", primary: false },
      { number: "+2222", primary: false },
    ];
    expect(getSDKPrimaryPhone(phones)?.number).toBe("+1111");
  });
});

// ─── CUSTOMER_STANDARD_FIELDS ────────────────────────────────────────────────

describe("CUSTOMER_STANDARD_FIELDS", () => {
  it("is a readonly array", () => {
    expect(Array.isArray(CUSTOMER_STANDARD_FIELDS)).toBe(true);
  });

  it("contains customerId", () => {
    expect(CUSTOMER_STANDARD_FIELDS).toContain("customerId");
  });

  it("contains identity", () => {
    expect(CUSTOMER_STANDARD_FIELDS).toContain("identity");
  });

  it("contains corporateIdentity", () => {
    expect(CUSTOMER_STANDARD_FIELDS).toContain("corporateIdentity");
  });

  it("contains emailAddresses", () => {
    expect(CUSTOMER_STANDARD_FIELDS).toContain("emailAddresses");
  });

  it("contains phoneNumbers", () => {
    expect(CUSTOMER_STANDARD_FIELDS).toContain("phoneNumbers");
  });

  it("contains programs", () => {
    expect(CUSTOMER_STANDARD_FIELDS).toContain("programs");
  });

  it("contains createdDateTime", () => {
    expect(CUSTOMER_STANDARD_FIELDS).toContain("createdDateTime");
  });

  it("contains modifiedDateTime", () => {
    expect(CUSTOMER_STANDARD_FIELDS).toContain("modifiedDateTime");
  });

  it("contains organizationId", () => {
    expect(CUSTOMER_STANDARD_FIELDS).toContain("organizationId");
  });

  it("has the expected number of fields", () => {
    expect(CUSTOMER_STANDARD_FIELDS).toHaveLength(22);
  });
});

// ─── detectActionType ───────────────────────────────────────────────────────

function makeAction(overrides: Partial<CustomerEventAction> = {}): CustomerEventAction {
  return {
    rank: 1,
    eventRuleId: "rule-1",
    eventRuleName: "Test Rule",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<CustomerEvent> = {}): CustomerEvent {
  return {
    eventId: "evt-1",
    eventType: "TRANSACTION",
    eventDateTime: "2025-06-01T12:00:00Z",
    title: "Test Event",
    description: "A test event",
    ...overrides,
  };
}

describe("detectActionType", () => {
  it("detects a known action type key", () => {
    const action = makeAction({ issueProgramCurrency: { amount: 100 } });
    expect(detectActionType(action)).toBe("issueProgramCurrency");
  });

  it("returns first matching key when multiple are present", () => {
    const action = makeAction({
      issueProgramCurrency: { amount: 100 },
      addCounterData: { counter: 1 },
    });
    const result = detectActionType(action);
    expect(["issueProgramCurrency", "addCounterData"]).toContain(result);
  });

  it("falls back to actionType field for unknown keys", () => {
    const action = makeAction({ actionType: "customAction" });
    expect(detectActionType(action)).toBe("customAction");
  });

  it('returns "unknown" when no type key or actionType is present', () => {
    const action = makeAction();
    expect(detectActionType(action)).toBe("unknown");
  });

  it("ignores null values for known keys", () => {
    const action = makeAction({ issueProgramCurrency: null, actionType: "fallback" });
    expect(detectActionType(action)).toBe("fallback");
  });
});

// ─── getEventActionBadgeLabel ───────────────────────────────────────────────

describe("getEventActionBadgeLabel", () => {
  it("returns null for event with no actions", () => {
    const event = makeEvent({ eventActions: [] });
    expect(getEventActionBadgeLabel(event)).toBeNull();
  });

  it("returns null for event with undefined actions", () => {
    const event = makeEvent({ eventActions: undefined });
    expect(getEventActionBadgeLabel(event)).toBeNull();
  });

  it("returns null for single action", () => {
    const event = makeEvent({
      eventActions: [makeAction({ issueProgramCurrency: { amount: 100 } })],
    });
    expect(getEventActionBadgeLabel(event)).toBeNull();
  });

  it("returns null for multiple actions of the same type", () => {
    const event = makeEvent({
      eventActions: [
        makeAction({ issueProgramCurrency: { amount: 100 } }),
        makeAction({ issueProgramCurrency: { amount: 200 } }),
        makeAction({ issueProgramCurrency: { amount: 300 } }),
      ],
    });
    expect(getEventActionBadgeLabel(event)).toBeNull();
  });

  it('returns "N Actions" for multiple actions with different types', () => {
    const event = makeEvent({
      eventActions: [
        makeAction({ issueProgramCurrency: { amount: 100 } }),
        makeAction({ addCounterData: { counter: 1 } }),
        makeAction({ registerTarget: { targetId: "t1" } }),
      ],
    });
    expect(getEventActionBadgeLabel(event)).toBe("3 Actions");
  });

  it('returns "N Actions" for two actions with two unique types', () => {
    const event = makeEvent({
      eventActions: [
        makeAction({ issueProgramCurrency: { amount: 100 } }),
        makeAction({ addCounterData: { counter: 1 } }),
      ],
    });
    expect(getEventActionBadgeLabel(event)).toBe("2 Actions");
  });
});

describe("indexLedgerByEventId", () => {
  function entry(overrides: Partial<LedgerEntry>): LedgerEntry {
    return {
      entryId: "ple_1",
      currencyCode: "POINTS",
      currencyName: "Points",
      amount: 100,
      type: "CREDIT",
      eventDateTime: "2026-01-01T00:00:00Z",
      description: "Welcome bonus",
      referenceId: "evt_1",
      status: "POSTED",
      ...overrides,
    };
  }

  it("indexes each entry by the event that produced it", () => {
    const first = entry({ entryId: "ple_1", referenceId: "evt_1" });
    const second = entry({ entryId: "ple_2", referenceId: "evt_2" });

    const index = indexLedgerByEventId([first, second]);

    expect(index.get("evt_1")).toBe(first);
    expect(index.get("evt_2")).toBe(second);
  });

  it("keeps the first entry when two share an event ID, rather than crashing", () => {
    // Shouldn't occur in practice, but the link must resolve deterministically.
    const first = entry({ entryId: "ple_first", referenceId: "evt_dup" });
    const second = entry({ entryId: "ple_second", referenceId: "evt_dup" });

    const index = indexLedgerByEventId([first, second]);

    expect(index.size).toBe(1);
    expect(index.get("evt_dup")).toBe(first);
  });

  it("skips entries with no originating event ID", () => {
    const index = indexLedgerByEventId([entry({ referenceId: "" })]);

    expect(index.size).toBe(0);
    expect(index.get("")).toBeUndefined();
  });
});
