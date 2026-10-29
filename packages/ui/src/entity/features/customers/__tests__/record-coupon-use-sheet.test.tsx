/**
 * RecordCouponUseSheet + coupon use helpers.
 *
 * The Platform pairs HOLD/USE/RETURN by reference ID and counts open holds and uses
 * against the offer's maxOfferUses, so the sheet must only offer what it will accept,
 * give new holds and uses a reference, and point USE (from a hold) and RETURN at the
 * existing entry they act on.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RecordCouponUseSheet } from "../record-coupon-use-sheet";
import {
  deriveCouponStatus,
  getCouponUseActions,
  getOpenCouponUses,
  type CustomerCouponEntry,
  type CustomerCouponUseEntry,
} from "../types";

function use(
  status: CustomerCouponUseEntry["status"],
  referenceId?: string,
  couponUseId = `${status}-${referenceId ?? "none"}`
): CustomerCouponUseEntry {
  return { couponUseId, status, eventDateTime: "2026-10-01T10:00:00Z", referenceId };
}

function coupon(overrides: Partial<CustomerCouponEntry> = {}): CustomerCouponEntry {
  const base: CustomerCouponEntry = {
    customerCouponId: "cc_1",
    couponId: "cp_1",
    couponCode: "SAVE10",
    couponName: "Save 10",
    offerCode: "OFFER",
    offerName: "Offer",
    status: "ACTIVE",
    issuedDateTime: "2026-09-01T10:00:00Z",
    cancelled: false,
    uses: [],
    ...overrides,
  };
  return { ...base, status: overrides.status ?? deriveCouponStatus(base) };
}

describe("coupon use helpers", () => {
  it("drops returned holds and uses from the open list", () => {
    // The Platform turns the returned row into RETURN in place; a stray RETURN with the
    // same reference also cancels the original.
    const uses = [use("RETURN", "A"), use("USE", "B"), use("HOLD", "C"), use("RETURN", "C", "r2")];
    expect(getOpenCouponUses(uses).map((u) => u.referenceId)).toEqual(["B"]);
  });

  it("derives Used only once every use slot is taken", () => {
    expect(deriveCouponStatus({ cancelled: false, uses: [use("USE", "A")] })).toBe("USED");
    expect(deriveCouponStatus({ cancelled: false, uses: [use("USE", "A")], maxUses: 3 })).toBe(
      "ACTIVE"
    );
    expect(deriveCouponStatus({ cancelled: false, uses: [use("RETURN", "A")] })).toBe("ACTIVE");
  });

  it("derives Held, Expired and Cancelled", () => {
    expect(deriveCouponStatus({ cancelled: false, uses: [use("HOLD", "A")] })).toBe("HELD");
    expect(
      deriveCouponStatus({ cancelled: false, uses: [], endDateTime: "2020-01-01T00:00:00Z" })
    ).toBe("EXPIRED");
    expect(deriveCouponStatus({ cancelled: true, uses: [use("USE", "A")] })).toBe("CANCELLED");
  });

  it("lets a used-up coupon be returned but not used again", () => {
    const actions = getCouponUseActions(coupon({ uses: [use("USE", "A")] }));
    expect(actions.canUse).toBe(false);
    expect(actions.canHold).toBe(false);
    expect(actions.returnableUses.map((u) => u.referenceId)).toEqual(["A"]);
  });

  it("lets a held single-use coupon be used by converting the hold", () => {
    const actions = getCouponUseActions(coupon({ uses: [use("HOLD", "H1")] }));
    expect(actions.canUse).toBe(true);
    expect(actions.canHold).toBe(false);
    expect(actions.convertibleHolds.map((u) => u.referenceId)).toEqual(["H1"]);
  });

  it("can't return a use recorded without a reference", () => {
    const actions = getCouponUseActions(coupon({ uses: [use("USE")] }));
    expect(actions.returnableUses).toEqual([]);
  });

  it("offers nothing on a cancelled or expired coupon", () => {
    const actions = getCouponUseActions(coupon({ cancelled: true }));
    expect(actions).toEqual({
      canUse: false,
      canHold: false,
      convertibleHolds: [],
      returnableUses: [],
    });
  });
});

describe("RecordCouponUseSheet", () => {
  function renderSheet(c: CustomerCouponEntry) {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RecordCouponUseSheet open onOpenChange={vi.fn()} coupon={c} onSubmit={onSubmit} />);
    return onSubmit;
  }

  it("records a use with a generated reference when none is typed", async () => {
    const user = userEvent.setup();
    const onSubmit = renderSheet(coupon());

    await user.type(screen.getByLabelText("Discount Value"), "10");
    await user.click(screen.getByRole("button", { name: "Record" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "USE",
        couponUseValue: 10,
        couponUseReferenceId: expect.stringMatching(/^CARE-[0-9A-F]{8}$/),
      })
    );
  });

  it("keeps a typed reference", async () => {
    const user = userEvent.setup();
    const onSubmit = renderSheet(coupon());

    await user.type(screen.getByLabelText("Reference ID"), "  TX-42 ");
    await user.click(screen.getByRole("button", { name: "Record" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ status: "USE", couponUseReferenceId: "TX-42" })
    );
  });

  it("returns the selected use on a used-up coupon", async () => {
    const user = userEvent.setup();
    const onSubmit = renderSheet(coupon({ uses: [use("USE", "TX-1")] }));

    // Use and Hold aren't accepted any more, so Return is the only action and the default.
    await user.click(screen.getByLabelText(/^Action/));
    expect(await screen.findByRole("option", { name: "Return" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Use" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(screen.queryByLabelText("Reference ID")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Record" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "RETURN",
        couponUseReferenceId: "TX-1",
        couponUseValue: undefined,
      })
    );
  });

  it("converts the hold when using a held single-use coupon", async () => {
    const user = userEvent.setup();
    const onSubmit = renderSheet(coupon({ uses: [use("HOLD", "H-1")] }));

    // No free slot, so there's no "New use" choice and no reference field.
    expect(screen.queryByLabelText("Reference ID")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Record" }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ status: "USE", couponUseReferenceId: "H-1" })
    );
  });
});
