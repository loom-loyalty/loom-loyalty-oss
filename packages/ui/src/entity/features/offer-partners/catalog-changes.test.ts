import type { OfferPartnerCatalogChange } from "@loom-loyalty/sdk";
import { describe, expect, it } from "vitest";

import { describeCatalogChange, isReviewableChange } from "./catalog-changes";

// The generated type maps each value to an object, but the API sends plain values.
const change = (value: object) => value as unknown as OfferPartnerCatalogChange;

describe("describeCatalogChange", () => {
  it("treats a retired item as applied by the sync, with nothing to answer", () => {
    const description = describeCatalogChange(
      change({
        changeType: "ITEM_RETIRED",
        status: "APPLIED",
        previousValue: { status: "ACTIVE" },
        proposedValue: { status: "RETIRED" },
      })
    );
    expect(description.needsReview).toBe(false);
    expect(description.statusLabel).toBe("Applied automatically");
    expect(description.impact).toMatch(/Paused automatically/);
  });

  it("names the paused amounts and the ones still on offer", () => {
    const description = describeCatalogChange(
      change({
        changeType: "DENOMINATIONS_PAUSED",
        status: "APPLIED",
        previousValue: { activeDenominations: ["5", "10", "25"] },
        proposedValue: { activeDenominations: ["10", "25"], pausedDenominations: ["5"] },
      })
    );
    expect(description.impact).toContain("$5");
    expect(description.lines).toEqual([
      { label: "Amounts", before: "$5, $10, $25", after: "$10, $25" },
    ]);
  });

  it("asks for review of a pending copy change and shows before and after", () => {
    const description = describeCatalogChange(
      change({
        changeType: "COPY",
        status: "PENDING",
        previousValue: { name: "Harbor Coffee eGift", description: "Old" },
        proposedValue: { name: "Harbor Coffee Co. eGift Card", description: "New" },
      })
    );
    expect(description.needsReview).toBe(true);
    expect(description.lines[0]).toEqual({
      label: "Name",
      before: "Harbor Coffee eGift",
      after: "Harbor Coffee Co. eGift Card",
    });
  });

  it("describes a range change in face values with its step", () => {
    const description = describeCatalogChange(
      change({
        changeType: "VALUE_RANGE",
        status: "PENDING",
        previousValue: { minValue: "10", maxValue: "100", stepValue: "5", fixedDenominations: [] },
        proposedValue: { minValue: "10", maxValue: "200", stepValue: "5", fixedDenominations: [] },
      })
    );
    expect(description.lines[0]?.after).toBe("$10–$200 in $5 steps");
    expect(description.impact).toMatch(/only clears this notice/);
  });

  it("stops asking once a change was answered", () => {
    expect(describeCatalogChange({ changeType: "COPY", status: "ACCEPTED" }).needsReview).toBe(
      false
    );
  });
});

describe("isReviewableChange", () => {
  it("is true only for copy, image and range changes", () => {
    expect(["COPY", "IMAGE", "VALUE_RANGE"].every(isReviewableChange)).toBe(true);
    expect(isReviewableChange("ITEM_RETIRED")).toBe(false);
    expect(isReviewableChange(undefined)).toBe(false);
  });
});
