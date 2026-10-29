import { describe, expect, it } from "vitest";

import {
  CATALOGUE_SIZE,
  ENGINE_ANNOUNCED_ACTIVITY_CODES,
  isCareOfferableActivity,
  isEngineAnnouncedActivity,
  LIFECYCLE_ACTIVITY_CODES,
  OFFERABLE_PLATFORM_ACTIVITY_CODES,
  SHEET_SERVED_ACTIVITY_CODES,
} from "./care-eligibility";

describe("care eligibility policy", () => {
  describe("engine-announced activities", () => {
    it.each(ENGINE_ANNOUNCED_ACTIVITY_CODES)(
      "does not offer %s, even when the registry returned it for the care surface",
      (code) => {
        expect(isCareOfferableActivity(code)).toBe(false);
        expect(isEngineAnnouncedActivity(code)).toBe(true);
      }
    );

    it("holds all 22 codes the engine announces", () => {
      expect(ENGINE_ANNOUNCED_ACTIVITY_CODES).toHaveLength(22);
    });
  });

  describe("activities already served by a bespoke sheet", () => {
    it.each(SHEET_SERVED_ACTIVITY_CODES)("does not offer %s", (code) => {
      expect(isCareOfferableActivity(code)).toBe(false);
    });

    it("is not misclassified as engine-announced", () => {
      // These are caller-asserted; they are withheld because a sheet already
      // covers them, not because submitting them would be forgery. Conflating
      // the two would make the exclusion look like a platform gate.
      for (const code of SHEET_SERVED_ACTIVITY_CODES) {
        expect(isEngineAnnouncedActivity(code)).toBe(false);
      }
    });
  });

  describe("event lifecycle codes", () => {
    it.each(LIFECYCLE_ACTIVITY_CODES)("does not offer %s as an activity to record", (code) => {
      expect(isCareOfferableActivity(code)).toBe(false);
    });
  });

  describe("caller-asserted platform activities with no sheet", () => {
    it.each(OFFERABLE_PLATFORM_ACTIVITY_CODES)("offers %s", (code) => {
      expect(isCareOfferableActivity(code)).toBe(true);
      expect(isEngineAnnouncedActivity(code)).toBe(false);
    });

    it("holds the seven platform activities in scope", () => {
      expect(OFFERABLE_PLATFORM_ACTIVITY_CODES).toHaveLength(7);
    });
  });

  describe("tenant-defined activities", () => {
    it.each(["hotel.stay", "laundromat.checkin", "purchase", "acme.widget.serviced", "stay"])(
      "offers the unknown code %s, since tenant-defined activities are absent from the catalogue",
      (code) => {
        expect(isCareOfferableActivity(code)).toBe(true);
      }
    );
  });

  describe("catalogue integrity", () => {
    // This is the test that fails loudly if a code is added to the care surface
    // without review. The four lists must partition the platform catalogue
    // exactly: adding a code to one list and not accounting for it in the
    // arithmetic breaks here rather than silently changing what care is offered.
    it("partitions the platform catalogue with no gaps or overlaps", () => {
      const all = [
        ...ENGINE_ANNOUNCED_ACTIVITY_CODES,
        ...SHEET_SERVED_ACTIVITY_CODES,
        ...LIFECYCLE_ACTIVITY_CODES,
        ...OFFERABLE_PLATFORM_ACTIVITY_CODES,
      ];

      expect(all).toHaveLength(CATALOGUE_SIZE);
      expect(new Set(all).size, "a code appears in more than one list").toBe(CATALOGUE_SIZE);
    });

    // The partition test above catches a code ADDED to two lists, but not one
    // MOVED from the engine-announced list into the offer set. The count and
    // uniqueness would both still hold. This asserts the dangerous codes
    // independently of the lists, so relocating one fails here.
    it.each([
      "tier.issued",
      "badge.issued",
      "coupon.issued",
      "coupon.cancelled",
      "external-offer.issued",
      "external-offer.cancelled",
      "target.achieved",
      "target.registered",
      "target.unachieved",
      "target.cancelled",
      "customer.created",
      "customer.updated",
      "audience.member.added",
      "audience.member.removed",
      "flow.started",
      "flow.exited",
    ])(
      "never offers %s, whichever list it is filed under, because submitting it would be forgery",
      (code) => {
        expect(isCareOfferableActivity(code)).toBe(false);
        expect(isEngineAnnouncedActivity(code)).toBe(true);
      }
    );

    it.each(["coupon.issue", "coupon.use", "badge.issue", "tier.issue"])(
      "never offers %s, whichever list it is filed under, because a bespoke sheet already covers it",
      (code) => {
        expect(isCareOfferableActivity(code)).toBe(false);
      }
    );

    it.each(["event.cancel", "event.update"])(
      "never offers %s as an activity to record, whichever list it is filed under",
      (code) => {
        expect(isCareOfferableActivity(code)).toBe(false);
      }
    );

    it("keeps every catalogue code out of the offer set unless it is an offerable platform activity", () => {
      const offerable = new Set<string>(OFFERABLE_PLATFORM_ACTIVITY_CODES);
      const catalogue = [
        ...ENGINE_ANNOUNCED_ACTIVITY_CODES,
        ...SHEET_SERVED_ACTIVITY_CODES,
        ...LIFECYCLE_ACTIVITY_CODES,
        ...OFFERABLE_PLATFORM_ACTIVITY_CODES,
      ];

      for (const code of catalogue) {
        expect(isCareOfferableActivity(code), `${code} disagrees with the offer set`).toBe(
          offerable.has(code)
        );
      }
    });
  });
});
