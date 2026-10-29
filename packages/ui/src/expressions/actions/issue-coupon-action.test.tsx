// Regression test for the coupon-reference segmented switch dead-end: selecting
// "Coupon code" or "Coupon ID" from the default ("Offer") state must actually
// show that segment's input, not silently snap back to "Offer" (adversarial
// review finding — the derived-only referenceMode never had a value to key off
// until the user typed into the newly-selected field).

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../forms/offer-field/use-offer-field.js", () => ({
  useOfferField: () => ({ findOffer: () => undefined }),
}));

const { IssueCouponActionComponent } = await import("./issue-coupon-action");

describe("IssueCouponActionComponent — coupon reference switch", () => {
  it("shows the Coupon Code input after selecting 'Coupon code' from the empty default", async () => {
    const user = userEvent.setup();
    render(<IssueCouponActionComponent value={{}} onChange={vi.fn()} />);

    await user.click(screen.getByRole("radio", { name: "Coupon code" }));

    expect(screen.getByLabelText("Coupon Code")).toBeInTheDocument();
  });

  it("shows the Coupon ID input after selecting 'Coupon ID' from the empty default", async () => {
    const user = userEvent.setup();
    render(<IssueCouponActionComponent value={{}} onChange={vi.fn()} />);

    await user.click(screen.getByRole("radio", { name: "Coupon ID" }));

    expect(screen.getByLabelText("Coupon ID")).toBeInTheDocument();
  });
});
