/**
 * Coupon Column Definitions
 *
 * Column definitions for the Coupons DataTable.
 * Uses extended columns for data-dense display.
 */

import { formatShortDate } from "@loom-loyalty/core";
import type { Column } from "../../../data-display/data-table.js";
import { CouponStatusBadge } from "./coupon-status-badge.js";
import type { CouponDetailProps } from "./types.js";

/** Type alias for coupon row data matching CouponDetailProps["coupon"] */
type CouponRow = CouponDetailProps["coupon"];

/**
 * Format redemptions display: "current / max" or just current count
 */
function formatRedemptions(coupon: CouponRow): string {
  const current = coupon.currentRedemptions ?? 0;
  if (coupon.maxRedemptions != null && coupon.maxRedemptions > 0) {
    return `${current} / ${coupon.maxRedemptions}`;
  }
  return `${current}`;
}

/**
 * Extended columns for the coupons table
 * Shows all relevant data for efficient coupon management
 */
export function getCouponColumnsExtended(): Column<CouponRow>[] {
  return [
    {
      key: "code",
      header: "Coupon",
      render: (coupon) => (
        <div>
          <p className="text-foreground font-medium">{coupon.name || coupon.code}</p>
          {coupon.name && <p className="text-muted-foreground font-mono text-xs">{coupon.code}</p>}
        </div>
      ),
    },
    {
      key: "offerName",
      header: "Offer",
      render: (coupon) => (
        <span className="text-muted-foreground text-sm">
          {coupon.offerName ?? coupon.offerId ?? "\u2014"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (coupon) => <CouponStatusBadge status={coupon.status} />,
    },
    {
      key: "currentRedemptions",
      header: "Redemptions",
      render: (coupon) => (
        <span className="text-muted-foreground text-sm">{formatRedemptions(coupon)}</span>
      ),
    },
    {
      key: "startDateTime",
      header: "Valid From",
      render: (coupon) =>
        coupon.startDateTime ? (
          <time dateTime={coupon.startDateTime} className="text-muted-foreground text-sm">
            {formatShortDate(coupon.startDateTime)}
          </time>
        ) : (
          <span className="text-muted-foreground text-sm">{"\u2014"}</span>
        ),
    },
    {
      key: "endDateTime",
      header: "Valid Until",
      render: (coupon) =>
        coupon.endDateTime ? (
          <time dateTime={coupon.endDateTime} className="text-muted-foreground text-sm">
            {formatShortDate(coupon.endDateTime)}
          </time>
        ) : (
          <span className="text-muted-foreground text-sm">{"\u2014"}</span>
        ),
    },
    {
      key: "createdDateTime",
      header: "Created",
      render: (coupon) =>
        coupon.createdDateTime ? (
          <time dateTime={coupon.createdDateTime} className="text-muted-foreground text-sm">
            {formatShortDate(coupon.createdDateTime)}
          </time>
        ) : (
          <span className="text-muted-foreground text-sm">{"\u2014"}</span>
        ),
    },
  ];
}
