import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CustomerPreview } from "../customer-detail";
import { CustomerHeader } from "../customer-header";
import type { CustomerData, CustomerPreviewProps } from "../types";

function renderPreview(programs: Array<Record<string, unknown>>) {
  const customer = {
    customerId: "cus_1",
    identity: { firstName: "Riley", lastName: "Referrer" },
    programs,
  } as unknown as CustomerPreviewProps["customer"];
  render(<CustomerPreview customer={customer} />);
}

describe("CustomerPreview — referral code", () => {
  it("shows a membership's referral code", () => {
    renderPreview([{ programCode: "coffee", referralCode: "K7QX-9PM2" }]);
    expect(screen.getByText("K7QX-9PM2")).toBeInTheDocument();
    expect(screen.getByText(/referral code/i)).toBeInTheDocument();
  });

  it("shows no referral line for a membership without a code", () => {
    renderPreview([{ programCode: "coffee" }]);
    expect(screen.getByText("coffee")).toBeInTheDocument();
    expect(screen.queryByText(/referral code/i)).not.toBeInTheDocument();
  });
});

// Customer preferred language (brief customer-preferred-language, C10): unset or unsupported
// reads as English.
describe("CustomerPreview — preferred language", () => {
  function renderWithLanguage(preferredLanguage?: string) {
    const customer = {
      customerId: "cus_1",
      identity: { firstName: "Riley", lastName: "Referrer" },
      ...(preferredLanguage === undefined ? {} : { preferredLanguage }),
    } as unknown as CustomerPreviewProps["customer"];
    render(<CustomerPreview customer={customer} />);
  }

  function languageValue() {
    const term = screen.getByText("Language", { selector: "dt" });
    return term.nextElementSibling?.textContent;
  }

  it("C10: shows Español for a customer whose language is es", () => {
    renderWithLanguage("es");
    expect(languageValue()).toBe("Español");
  });

  it.each([[undefined], ["en"], ["fr"]])("shows English for %j", (preferredLanguage) => {
    renderWithLanguage(preferredLanguage);
    expect(languageValue()).toBe("English");
  });
});

describe("CustomerHeader — preferred language", () => {
  function headerData(preferredLanguage?: string): CustomerData {
    return {
      customer: {
        customerId: "cus_1",
        identity: { firstName: "Avery", lastName: "Stone" },
        statusCode: "ACTIVE",
        statusName: "Active",
        fraudStatusCode: "CLEAR",
        enrollmentChannel: "WEB",
        enrollmentDateTime: "2026-01-01T10:00:00Z",
        createdAt: "2026-01-01T10:00:00Z",
        preferredLanguage,
      },
      emails: [],
      phones: [],
      addresses: [],
      programs: [],
      tiers: [],
      badges: [],
      currencies: [],
      ledger: [],
      segments: [],
      events: [],
      preferences: [],
      identifiers: [],
      coupons: [],
      tags: [],
    };
  }

  it("C10: shows Español on the customer page header", () => {
    render(<CustomerHeader data={headerData("es")} />);
    expect(screen.getByLabelText("Preferred language")).toHaveTextContent("Español");
  });

  it("shows English when the language is unset", () => {
    render(<CustomerHeader data={headerData()} />);
    expect(screen.getByLabelText("Preferred language")).toHaveTextContent("English");
  });
});
