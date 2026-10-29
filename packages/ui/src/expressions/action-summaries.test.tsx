import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getActionSummary } from "./action-summaries";
import type { ActionSummaryLookups } from "./action-summary-lookups";

const resolve: ActionSummaryLookups = {
  programName: () => "Rewards Program",
  offerName: () => "Free Delivery",
  badgeName: () => "Early Adopter",
  tierName: () => "Gold",
  targetName: () => "Monthly Spend",
  eventRuleName: () => "Order placed",
  audienceName: () => "VIP Customers",
  fieldName: (path) => (path === "$.eventData.order.orderTotal" ? "Order total" : undefined),
};

const cases: Array<[string, Record<string, unknown>, string]> = [
  [
    "issueProgramCurrency",
    { defaultResult: 10, isFixedAmount: true, programCurrencyCode: "POINTS" },
    "Issue 10 POINTS to the customer",
  ],
  [
    "withdrawProgramCurrency",
    { defaultResult: 10, isFixedAmount: true, programCurrencyCode: "POINTS" },
    "Withdraw 10 POINTS from the customer",
  ],
  ["issueCustomerCoupon", { couponOfferId: "offer-1" }, "Issue offer Free Delivery"],
  ["useCustomerCoupon", { defaultResult: "SAVE10" }, "Use coupon SAVE10"],
  ["holdCustomerCoupon", { defaultResult: "SAVE10" }, "Hold coupon SAVE10"],
  ["returnCustomerCoupon", { defaultResult: "SAVE10" }, "Return coupon SAVE10"],
  ["cancelCustomerCoupon", { couponCode: "SAVE10" }, "Cancel coupon SAVE10"],
  ["issueCustomerBadge", { badgeId: "badge-1" }, "Issue badge Early Adopter"],
  ["issueCustomerTier", { tierId: "tier-1", issueLifetimeTier: true }, "Issue lifetime tier Gold"],
  [
    "registerTarget",
    { targetId: "target-1", programId: "program-1" },
    "Register target Monthly Spend on Rewards Program",
  ],
  [
    "addCounterData",
    { defaultResult: 1, isFixedAmount: true, targetId: "target-1" },
    "Add 1 to target Monthly Spend",
  ],
  ["completeTargetData", { targetId: "target-1" }, "Complete target Monthly Spend"],
  ["metadataTagging", { metadataCode: "vip", metadataTypeCode: "segment" }, "Tag vip (segment)"],
  [
    "sendNotification",
    { channelCode: "EMAIL", templateCode: "WELCOME" },
    "Send notification via EMAIL using template WELCOME",
  ],
  [
    "addCustomerToAudience",
    { customerAudienceId: "audience-1" },
    "Add customer to audience VIP Customers",
  ],
  [
    "removeCustomerFromAudience",
    { customerAudienceId: "audience-1" },
    "Remove customer from audience VIP Customers",
  ],
  ["issueCustomerExternalOffer", { offerId: "offer-1" }, "Issue external offer Free Delivery"],
  [
    "issueCustomerExternalOffer",
    { offerId: "offer-1", partnerDenomination: "25" },
    "Issue external offer Free Delivery at 25",
  ],
  ["cancelCustomerExternalOffer", { offerId: "offer-1" }, "Cancel external offer Free Delivery"],
];

describe("getActionSummary", () => {
  it.each(cases)("formats %s", (type, data, expected) => {
    const { container } = render(<>{getActionSummary(type, data, resolve)}</>);
    expect(container).toHaveTextContent(expected);
  });

  it("uses the destructive required-value affordance for unset fields", () => {
    render(<>{getActionSummary("issueCustomerCoupon", {}, resolve)}</>);
    expect(screen.getByText("Set coupon reference")).toHaveClass("text-destructive");
  });

  it("renders a schema-bound amount as a field chip", () => {
    render(
      <>
        {getActionSummary(
          "issueProgramCurrency",
          {
            isFixedAmount: false,
            path: "$.eventData.order.orderTotal",
            programCurrencyCode: "POINTS",
          },
          resolve
        )}
      </>
    );
    expect(screen.getByText("Order total")).toBeInTheDocument();
  });
});
