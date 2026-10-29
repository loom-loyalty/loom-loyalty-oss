/**
 * Customer Column Definitions — Unit Tests
 *
 * Tests for getCustomerColumnsExtended() from customer-columns.tsx.
 */

import type { Customer } from "@loom-loyalty/sdk";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getCustomerColumnsExtended } from "../customer-columns.js";

// Mock formatShortDate to avoid locale-dependent output in tests
vi.mock("@loom-loyalty/core", () => ({
  formatShortDate: (d: string) => `formatted:${d}`,
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeSDKCustomer(overrides: Record<string, unknown> = {}): Customer {
  return {
    customerId: "cust_abc123",
    identity: { firstName: "Jane", lastName: "Doe" },
    emailAddresses: [{ emailAddress: "jane@example.com", primary: true }],
    status: { name: "Active", code: "ACTIVE" },
    programs: [{ programId: "p1" }],
    createdDateTime: "2025-06-01T00:00:00Z",
    modifiedDateTime: "2025-06-15T00:00:00Z",
    ...overrides,
  } as Customer;
}

// ─── Column count & headers ──────────────────────────────────────────────────

describe("getCustomerColumnsExtended", () => {
  const columns = getCustomerColumnsExtended();

  it("returns 6 columns", () => {
    expect(columns).toHaveLength(6);
  });

  it("has correct column keys", () => {
    const keys = columns.map((c) => c.key);
    expect(keys).toEqual([
      "name",
      "type",
      "status",
      "programs",
      "createdDateTime",
      "modifiedDateTime",
    ]);
  });

  it("has correct column headers", () => {
    const headers = columns.map((c) => c.header);
    expect(headers).toEqual(["Customer", "Type", "Status", "Programs", "Created", "Modified"]);
  });
});

// ─── Column render functions ─────────────────────────────────────────────────

describe("Customer column — render", () => {
  const columns = getCustomerColumnsExtended();
  const findColumn = (key: string) => columns.find((c) => c.key === key)!;

  describe("name column", () => {
    it("renders customer name and primary email", () => {
      const customer = makeSDKCustomer();
      const { container } = render(<>{findColumn("name").render(customer)}</>);
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
      expect(screen.getByText("jane@example.com")).toBeInTheDocument();
      // Verify structure has two paragraphs
      const paragraphs = container.querySelectorAll("p");
      expect(paragraphs).toHaveLength(2);
    });

    it("renders em dash when no email addresses", () => {
      const customer = makeSDKCustomer({ emailAddresses: undefined });
      render(<>{findColumn("name").render(customer)}</>);
      expect(screen.getByText("\u2014")).toBeInTheDocument();
    });
  });

  describe("type column", () => {
    it('renders "Individual" for customers without corporate identity', () => {
      const customer = makeSDKCustomer({ corporateIdentity: undefined });
      render(<>{findColumn("type").render(customer)}</>);
      expect(screen.getByText("Individual")).toBeInTheDocument();
    });

    it('renders "Corporate" for customers with corporate identity', () => {
      const customer = makeSDKCustomer({
        corporateIdentity: { companyName: "Acme" },
        identity: undefined,
      });
      render(<>{findColumn("type").render(customer)}</>);
      expect(screen.getByText("Corporate")).toBeInTheDocument();
    });
  });

  describe("status column", () => {
    it("renders status name from the status object", () => {
      const customer = makeSDKCustomer({ status: { name: "Suspended", code: "SUSPENDED" } });
      render(<>{findColumn("status").render(customer)}</>);
      expect(screen.getByText("Suspended")).toBeInTheDocument();
    });

    it('renders "Unknown" when status is missing', () => {
      const customer = makeSDKCustomer({ status: undefined });
      render(<>{findColumn("status").render(customer)}</>);
      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });

    it("falls back to status code when name is missing", () => {
      const customer = makeSDKCustomer({ status: { code: "PAUSED" } });
      render(<>{findColumn("status").render(customer)}</>);
      expect(screen.getByText("Paused")).toBeInTheDocument();
    });
  });

  describe("programs column", () => {
    it("renders program count when programs exist", () => {
      const customer = makeSDKCustomer({ programs: [{ programId: "p1" }, { programId: "p2" }] });
      render(<>{findColumn("programs").render(customer)}</>);
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("renders em dash when no programs", () => {
      const customer = makeSDKCustomer({ programs: [] });
      render(<>{findColumn("programs").render(customer)}</>);
      expect(screen.getByText("\u2014")).toBeInTheDocument();
    });

    it("renders em dash when programs is undefined", () => {
      const customer = makeSDKCustomer({ programs: undefined });
      render(<>{findColumn("programs").render(customer)}</>);
      expect(screen.getByText("\u2014")).toBeInTheDocument();
    });
  });

  describe("createdDateTime column", () => {
    it("renders formatted date when present", () => {
      const customer = makeSDKCustomer({ createdDateTime: "2025-06-01T00:00:00Z" });
      render(<>{findColumn("createdDateTime").render(customer)}</>);
      expect(screen.getByText("formatted:2025-06-01T00:00:00Z")).toBeInTheDocument();
      // Should use <time> element
      const timeEl = screen.getByText("formatted:2025-06-01T00:00:00Z").closest("time");
      expect(timeEl).toHaveAttribute("dateTime", "2025-06-01T00:00:00Z");
    });

    it("renders em dash when createdDateTime is missing", () => {
      const customer = makeSDKCustomer({ createdDateTime: undefined });
      render(<>{findColumn("createdDateTime").render(customer)}</>);
      expect(screen.getByText("\u2014")).toBeInTheDocument();
    });
  });

  describe("modifiedDateTime column", () => {
    it("renders formatted date when present", () => {
      const customer = makeSDKCustomer({ modifiedDateTime: "2025-06-15T00:00:00Z" });
      render(<>{findColumn("modifiedDateTime").render(customer)}</>);
      expect(screen.getByText("formatted:2025-06-15T00:00:00Z")).toBeInTheDocument();
      const timeEl = screen.getByText("formatted:2025-06-15T00:00:00Z").closest("time");
      expect(timeEl).toHaveAttribute("dateTime", "2025-06-15T00:00:00Z");
    });

    it("renders em dash when modifiedDateTime is missing", () => {
      const customer = makeSDKCustomer({ modifiedDateTime: undefined });
      render(<>{findColumn("modifiedDateTime").render(customer)}</>);
      expect(screen.getByText("\u2014")).toBeInTheDocument();
    });
  });
});
