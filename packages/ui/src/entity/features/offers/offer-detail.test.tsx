import type { Offer } from "@loom-loyalty/sdk";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OfferDetail } from "./offer-detail";

const couponOffer = { offerId: "offer-1", code: "SPRING", name: "Spring", type: "COUPON" } as Offer;
const coupons = [{ id: "c1", code: "CODE1", offerId: "offer-1", status: "ACTIVE" }];

describe("OfferDetail coupon table", () => {
  it("shows the coupon page footer when the caller pages coupons on the server", () => {
    render(
      <OfferDetail
        offer={couponOffer}
        coupons={coupons}
        couponsPagination={{
          page: 2,
          pageSize: 25,
          total: 60,
          onPageChange: vi.fn(),
          onPageSizeChange: vi.fn(),
        }}
      />
    );

    expect(screen.getByText("Rows per page")).toBeInTheDocument();
    expect(screen.getByText(/of 60 results/)).toBeInTheDocument();
  });

  it("leaves the coupon table unpaged without couponsPagination", () => {
    render(<OfferDetail offer={couponOffer} coupons={coupons} />);

    expect(screen.getByText("CODE1")).toBeInTheDocument();
    expect(screen.queryByText("Rows per page")).not.toBeInTheDocument();
  });
});
