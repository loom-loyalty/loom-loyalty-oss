/**
 * Offer Detail Sheet Content
 *
 * Displays all Offer fields with Edit and Delete action buttons.
 * Shows embedded coupon table for COUPON type offers,
 * or external offer config for EXTERNAL type offers.
 * Supports extended fields from data model extensions.
 */

import { extractLocalizedString, formatDateTime } from "@loom-loyalty/core";
import { Edit, ExternalLink, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { DataTable } from "../../../data-display/data-table.js";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import { Skeleton } from "../../../primitives/skeleton.js";
import {
  EnvironmentEnablementList,
  isEnabledNow,
} from "../../environment-workflow/environment-status-column.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";
import { getCouponColumnsExtended } from "../coupons/coupon-columns.js";
import type { CouponDetailProps } from "../coupons/types.js";
import { OfferStatusBadge } from "./offer-status-badge.js";
import { OfferTypeBadge } from "./offer-type-badge.js";
import type { OfferDetailProps } from "./types.js";

/** Coupon row type from the coupon feature */
type CouponRow = CouponDetailProps["coupon"];

/**
 * Format duration period for display
 */
function formatDurationPeriod(dp: {
  durationPeriod?: string;
  durationPeriodType?: string;
  durationPeriodValue?: number;
}): string {
  if (!dp.durationPeriodValue || !dp.durationPeriod) return "\u2014";
  const type = dp.durationPeriodType ? ` (${dp.durationPeriodType.toLowerCase()})` : "";
  return `${dp.durationPeriodValue} ${dp.durationPeriod.toLowerCase()}${type}`;
}

/**
 * Offer detail content for Sheet display
 */
export function OfferDetail({
  offer,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  schema,
  extendedFields = [],
  coupons,
  couponsLoading,
  couponsPagination,
  onCreateCoupon,
  onEditCoupon,
  onDeleteCoupon,
  externalOfferConfig,
  partnerSection,
}: OfferDetailProps): ReactNode {
  const description = extractLocalizedString(offer.description);
  const isActive = isEnabledNow(offer.enabledInEnvironments);

  // Row-click edits a coupon. Wire it (with its required a11y label) only when an
  // edit handler exists, so a read-only table has no focusable-but-nameless rows.
  const couponRowActivation:
    | { onRowClick?: undefined; getRowLabel?: never }
    | { onRowClick: (coupon: CouponRow) => void; getRowLabel: (coupon: CouponRow) => string } =
    onEditCoupon
      ? {
          onRowClick: onEditCoupon,
          getRowLabel: (coupon) => `Edit coupon ${coupon.name || coupon.code}`,
        }
      : {};

  return (
    <div className="space-y-6">
      {/* Overview */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">Overview</h3>
        <div className="space-y-3">
          <DetailRow label="Name" value={offer.name} />
          <DetailRow label="Code" value={offer.code} mono />
          <div>
            <p className="text-muted-foreground text-sm">Type</p>
            <div className="mt-1">
              <OfferTypeBadge type={offer.type} />
            </div>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Status</p>
            <div className="mt-1">
              <OfferStatusBadge active={isActive} />
            </div>
          </div>
          {description && <DetailRow label="Description" value={description} />}
        </div>
      </section>

      {/* Programs */}
      {offer.programIds && offer.programIds.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Programs
          </h3>
          <div className="flex flex-wrap gap-2">
            {offer.programIds.map((id) => (
              <Badge key={id} variant="outline" className="font-mono text-xs">
                {id}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* Configuration */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Configuration
        </h3>
        <div className="space-y-3">
          {offer.durationPeriod && (
            <DetailRow label="Duration Period" value={formatDurationPeriod(offer.durationPeriod)} />
          )}
          <DetailRow
            label="Max Offer Uses"
            value={offer.maxOfferUses != null ? String(offer.maxOfferUses) : "Unlimited"}
          />
          <DetailRow
            label="Max Offer Redemptions"
            value={
              offer.maxOfferRedemptions != null ? String(offer.maxOfferRedemptions) : "Unlimited"
            }
          />
          <DetailRow
            label="Set Date/Time Period on Issue"
            value={offer.setDateTimePeriodOnIssue ? "Yes" : "No"}
          />
        </div>
      </section>

      {/* Environments */}
      {offer.enabledInEnvironments && offer.enabledInEnvironments.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Enabled Environments
          </h3>
          <EnvironmentEnablementList enabledInEnvironments={offer.enabledInEnvironments} />
        </section>
      )}

      {/* Coupons Section (COUPON type only) */}
      {offer.type === "COUPON" && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
              Coupons
            </h3>
            {canEdit && onCreateCoupon && (
              <Button variant="outline" size="sm" onClick={onCreateCoupon} aria-label="Add coupon">
                <Plus className="mr-1 h-3 w-3" aria-hidden="true" />
                Add Coupon
              </Button>
            )}
          </div>
          {couponsLoading ? (
            <div className="space-y-2" role="status" aria-label="Loading coupons">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : coupons && coupons.length > 0 ? (
            <div className="border-border overflow-hidden rounded-lg border">
              <DataTable<CouponRow>
                columns={getCouponColumnsExtended().filter((col) => col.key !== "offerName")}
                data={coupons}
                getRowKey={(coupon) => coupon.id}
                {...couponRowActivation}
                pagination={couponsPagination}
                actions={
                  canEdit
                    ? [
                        ...(onEditCoupon
                          ? [
                              {
                                label: "Edit",
                                onClick: (item: unknown) => onEditCoupon(item as CouponRow),
                              },
                            ]
                          : []),
                        ...(onDeleteCoupon
                          ? [
                              {
                                label: "Delete",
                                destructive: true,
                                onClick: (item: unknown) => onDeleteCoupon(item as CouponRow),
                              },
                            ]
                          : []),
                      ]
                    : undefined
                }
                emptyMessage="No coupons yet. Add a coupon to get started."
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No coupons yet. Add a coupon to get started.
            </p>
          )}
        </section>
      )}

      {/* Partner source (EXTERNAL offers a partner fulfils) */}
      {offer.type === "EXTERNAL" && partnerSection}

      {/* External Offer Section (EXTERNAL type only) */}
      {offer.type === "EXTERNAL" && !partnerSection && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            External Offer Configuration
          </h3>
          {externalOfferConfig && Object.keys(externalOfferConfig).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(externalOfferConfig).map(([key, value]) => (
                <DetailRow key={key} label={key} value={String(value)} />
              ))}
            </div>
          ) : (
            <div className="bg-muted/50 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <ExternalLink className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                <p className="text-muted-foreground text-sm">
                  External offer integration configured via webhook.
                </p>
              </div>
            </div>
          )}
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
            value={formatDateTime(offer.createdDateTime) ?? "\u2014"}
            dateTime={offer.createdDateTime}
          />
          <DetailRow
            label="Last Modified"
            value={formatDateTime(offer.modifiedDateTime) ?? "\u2014"}
            dateTime={offer.modifiedDateTime}
          />
        </div>
      </section>

      {/* ID (if available) */}
      {offer.offerId && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">System</h3>
          <DetailRow label="Offer ID" value={offer.offerId} mono />
        </section>
      )}

      {/* Extended Fields Section (from data model extensions) */}
      {schema && extendedFields.length > 0 && (
        <ExtendedFieldsSection
          schema={schema}
          fields={extendedFields}
          data={offer}
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
