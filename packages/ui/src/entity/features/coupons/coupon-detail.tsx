/**
 * Coupon Detail Sheet Content
 *
 * Displays all Coupon fields with Edit and Delete action buttons.
 * Supports extended fields from data model extensions.
 */

import { formatDateTime } from "@loom-loyalty/core";
import { Edit, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../../primitives/button.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";
import { CouponStatusBadge } from "./coupon-status-badge.js";
import type { CouponDetailProps } from "./types.js";

/**
 * Coupon detail content for Sheet display
 */
export function CouponDetail({
  coupon,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  schema,
  extendedFields = [],
}: CouponDetailProps): ReactNode {
  const hasRedemptionLimit = coupon.maxRedemptions != null && coupon.maxRedemptions > 0;
  const redemptionProgress =
    hasRedemptionLimit && coupon.currentRedemptions != null
      ? Math.min((coupon.currentRedemptions / coupon.maxRedemptions!) * 100, 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Overview */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">Overview</h3>
        <div className="space-y-3">
          <DetailRow label="Code" value={coupon.code} mono />
          {coupon.name && <DetailRow label="Name" value={coupon.name} />}
          <div>
            <p className="text-muted-foreground text-sm">Status</p>
            <div className="mt-1">
              <CouponStatusBadge status={coupon.status} />
            </div>
          </div>
          {(coupon.offerName || coupon.offerId) && (
            <DetailRow label="Offer" value={coupon.offerName ?? coupon.offerId ?? "\u2014"} />
          )}
        </div>
      </section>

      {/* Redemptions */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Redemptions
        </h3>
        <div className="space-y-3">
          {hasRedemptionLimit ? (
            <>
              <DetailRow
                label="Current / Max"
                value={`${coupon.currentRedemptions ?? 0} / ${coupon.maxRedemptions}`}
              />
              <div>
                <p className="text-muted-foreground text-sm">Progress</p>
                <div className="mt-2">
                  <div
                    className="bg-muted h-2 w-full overflow-hidden rounded-full"
                    role="progressbar"
                    aria-valuenow={coupon.currentRedemptions ?? 0}
                    aria-valuemin={0}
                    aria-valuemax={coupon.maxRedemptions!}
                    aria-label="Redemption progress"
                  >
                    <div
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${redemptionProgress}%` }}
                    />
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {redemptionProgress.toFixed(0)}% redeemed
                  </p>
                </div>
              </div>
            </>
          ) : (
            <DetailRow
              label="Redemptions"
              value={
                coupon.currentRedemptions != null
                  ? `${coupon.currentRedemptions} (unlimited)`
                  : "Unlimited"
              }
            />
          )}
        </div>
      </section>

      {/* Validity */}
      {(coupon.startDateTime || coupon.endDateTime) && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Validity Period
          </h3>
          <div className="space-y-3">
            {coupon.startDateTime && (
              <DetailRow
                label="Start Date"
                value={formatDateTime(coupon.startDateTime) ?? "\u2014"}
                dateTime={coupon.startDateTime}
              />
            )}
            {coupon.endDateTime && (
              <DetailRow
                label="End Date"
                value={formatDateTime(coupon.endDateTime) ?? "\u2014"}
                dateTime={coupon.endDateTime}
              />
            )}
          </div>
        </section>
      )}

      {/* Timestamps */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Timestamps
        </h3>
        <div className="space-y-3">
          <DetailRow
            label="Created"
            value={formatDateTime(coupon.createdDateTime) ?? "\u2014"}
            dateTime={coupon.createdDateTime}
          />
          <DetailRow
            label="Last Modified"
            value={formatDateTime(coupon.updatedDateTime) ?? "\u2014"}
            dateTime={coupon.updatedDateTime}
          />
        </div>
      </section>

      {/* Extended Fields Section (from data model extensions) */}
      {schema && extendedFields.length > 0 && (
        <ExtendedFieldsSection
          schema={schema}
          fields={extendedFields}
          data={coupon}
          mode="view"
          title="Additional Information"
          defaultCollapsed={false}
        />
      )}

      {/* Action Buttons */}
      {(canEdit || canDelete) && (
        <div className="border-border flex gap-2 border-t pt-4">
          {canDelete && onDelete && (
            <Button variant="outline" className="flex-1" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Delete
            </Button>
          )}
          {canEdit && onEdit && (
            <Button variant="primary-gradient" className="flex-1" onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" aria-hidden="true" />
              Edit
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
  mono?: boolean;
  /** ISO date string for semantic <time> element */
  dateTime?: string;
}

function DetailRow({ label, value, mono, dateTime }: DetailRowProps) {
  const content = dateTime ? <time dateTime={dateTime}>{value}</time> : value;

  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className={mono ? "text-foreground font-mono text-sm" : "text-foreground font-medium"}>
        {content}
      </p>
    </div>
  );
}
