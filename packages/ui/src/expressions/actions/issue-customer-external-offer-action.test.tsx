// A partner reward's action shows the amount it issues, and choosing another
// offer drops it: the amount belongs to the old offer's partner link.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../forms/offer-field/use-offer-field.js", () => ({
  useOfferField: () => ({ findOffer: () => ({ code: "other-offer" }) }),
}));

vi.mock("../../forms/offer-field/index.js", () => ({
  OfferField: ({ onValueChange }: { onValueChange: (id: string) => void }) => (
    <button type="button" onClick={() => onValueChange("offer_2")}>
      Pick another offer
    </button>
  ),
}));

const { IssueCustomerExternalOfferActionComponent } =
  await import("./issue-customer-external-offer-action");

const VALUE = {
  offerId: "offer_1",
  synchronous: true,
  partnerDenomination: "25",
};

describe("IssueCustomerExternalOfferActionComponent", () => {
  it("shows the partner amount", () => {
    render(<IssueCustomerExternalOfferActionComponent value={VALUE} onChange={vi.fn()} />);
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("drops the partner amount when the offer changes", async () => {
    const onChange = vi.fn();
    render(<IssueCustomerExternalOfferActionComponent value={VALUE} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Pick another offer" }));
    expect(onChange).toHaveBeenCalledWith({
      offerId: "offer_2",
      offerCode: "other-offer",
      synchronous: true,
      partnerDenomination: undefined,
    });
  });
});
