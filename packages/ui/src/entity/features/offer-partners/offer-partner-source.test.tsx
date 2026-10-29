/**
 * OfferPartnerSource: answer errors show only on the change they belong to,
 * Pause and Resume share one button, and unlinking moves focus to the heading.
 */
import type { OfferPartnerCatalogChange, OfferPartnerOfferLink } from "@loom-loyalty/sdk";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OfferPartnerSource } from "./offer-partner-source.js";

const LINK: OfferPartnerOfferLink = {
  offerLinkId: "link_1",
  offerId: "offer_1",
  partnerCode: "gift-cards",
  partnerItemId: "GC-1042",
  currency: "USD",
  status: "ACTIVE",
  denominations: [{ value: 10, status: "ACTIVE" }],
};

function change(id: string, name: string): OfferPartnerCatalogChange {
  return {
    catalogChangeId: id,
    offerLinkId: "link_1",
    changeType: "COPY",
    status: "PENDING",
    previousValue: { name: "Old" },
    proposedValue: { name },
  } as unknown as OfferPartnerCatalogChange;
}

describe("OfferPartnerSource", () => {
  it("shows an answer error only on the change it belongs to", () => {
    render(
      <OfferPartnerSource
        partnerName="Gift cards"
        link={LINK}
        pendingChanges={[change("chg_1", "First"), change("chg_2", "Second")]}
        onAnswerChange={vi.fn()}
        answerError="Couldn't save your answer."
        answerErrorChangeId="chg_2"
      />
    );
    expect(screen.getAllByText("Couldn't save your answer.")).toHaveLength(1);
  });

  it("shows no answer error when it belongs to no listed change", () => {
    render(
      <OfferPartnerSource
        partnerName="Gift cards"
        link={LINK}
        pendingChanges={[change("chg_1", "First")]}
        onAnswerChange={vi.fn()}
        answerError="Couldn't save your answer."
        answerErrorChangeId="chg_9"
      />
    );
    expect(screen.queryByText("Couldn't save your answer.")).toBeNull();
  });

  it("keeps one Pause/Resume button and ignores clicks while saving", async () => {
    const onPause = vi.fn();
    const onResume = vi.fn();
    const props = { partnerName: "Gift cards", onPause, onResume, onUnlink: vi.fn() };
    const { rerender } = render(<OfferPartnerSource {...props} link={LINK} updating />);
    const button = screen.getByRole("button", { name: "Pause offer" });
    await userEvent.click(button);
    expect(onPause).not.toHaveBeenCalled();

    rerender(<OfferPartnerSource {...props} link={LINK} />);
    await userEvent.click(button);
    expect(onPause).toHaveBeenCalledOnce();

    rerender(<OfferPartnerSource {...props} link={{ ...LINK, status: "PAUSED" }} />);
    expect(button).toHaveTextContent("Resume offer");
    expect(button).toHaveFocus();
  });

  it("moves focus to the heading when the link is retired", () => {
    const props = { partnerName: "Gift cards", onUnlink: vi.fn() };
    const { rerender } = render(<OfferPartnerSource {...props} link={LINK} />);
    rerender(<OfferPartnerSource {...props} link={{ ...LINK, status: "RETIRED" }} />);
    expect(screen.getByRole("heading", { name: "Partner source" })).toHaveFocus();
    expect(screen.queryByRole("button", { name: /Unlink/ })).toBeNull();
  });

  it("offers Price it only when the caller can price, and not once retired", async () => {
    const onPrice = vi.fn();
    const { rerender } = render(
      <OfferPartnerSource partnerName="Gift cards" link={LINK} onPrice={onPrice} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Price it" }));
    expect(onPrice).toHaveBeenCalledOnce();

    rerender(<OfferPartnerSource partnerName="Gift cards" link={LINK} />);
    expect(screen.queryByRole("button", { name: "Price it" })).toBeNull();

    rerender(
      <OfferPartnerSource
        partnerName="Gift cards"
        link={{ ...LINK, status: "RETIRED" }}
        onPrice={onPrice}
      />
    );
    expect(screen.queryByRole("button", { name: "Price it" })).toBeNull();
  });
});
