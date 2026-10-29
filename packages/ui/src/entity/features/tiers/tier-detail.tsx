/**
 * Tier Detail Sheet Content
 *
 * Displays all Tier fields with Edit and Delete action buttons.
 * Supports extended fields from data model extensions.
 */

import { formatDateTime } from "@loom-loyalty/core";
import type { UIEntitySchema } from "@loom-loyalty/schema";
import type { Tier } from "@loom-loyalty/sdk";
import { Edit, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../../primitives/button.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";
import { formatDurationPeriod } from "../../format-duration-period.js";
import { TierRankBadge } from "../tier-rank-badge.js";
import { getDescription } from "./tier-columns.js";

export interface TierDetailProps {
  /** Tier to display */
  tier: Tier;
  /** Edit click handler */
  onEdit?: () => void;
  /** Delete click handler */
  onDelete?: () => void;
  /** Whether editing is enabled */
  canEdit?: boolean;
  /** Whether deletion is enabled */
  canDelete?: boolean;
  /** Schema for rendering extended fields (optional) */
  schema?: UIEntitySchema;
  /** Extended field names to render (beyond standard fields) */
  extendedFields?: string[];
}

/**
 * Tier detail content for Sheet display
 */
export function TierDetail({
  tier,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  schema,
  extendedFields = [],
}: TierDetailProps): ReactNode {
  const description = getDescription(tier.description);

  // Format duration period
  const durationDisplay = formatDurationPeriod(tier.durationPeriod);

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Basic Information
        </h3>
        <div className="space-y-3">
          <DetailRow label="Name" value={tier.name} />
          <DetailRow label="Code" value={tier.code} mono />
          {description && <DetailRow label="Description" value={description} />}
        </div>
      </section>

      {/* Tier Configuration */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Tier Configuration
        </h3>
        <div className="space-y-3">
          <div>
            <p className="text-muted-foreground text-sm">Rank</p>
            {tier.rank != null ? (
              <div className="mt-1">
                <TierRankBadge rank={tier.rank} tierName={tier.name} size="md" />
              </div>
            ) : (
              <p className="text-foreground font-medium">{"\u2014"}</p>
            )}
          </div>
          <DetailRow label="Subscription" value={tier.subscription ? "Yes" : "No"} />
          {durationDisplay && <DetailRow label="Duration" value={durationDisplay} />}
          {tier.tierExpiryDowngradeTierId && (
            <DetailRow label="Downgrade Tier ID" value={tier.tierExpiryDowngradeTierId} mono />
          )}
          {(() => {
            const downgradeDuration = formatDurationPeriod(tier.tierExpiryDowngradeDurationPeriod);
            return (
              downgradeDuration && (
                <DetailRow label="Downgrade Duration" value={downgradeDuration} />
              )
            );
          })()}
        </div>
      </section>

      {/* Programs */}
      {tier.programIds && tier.programIds.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Programs
          </h3>
          <DetailRow
            label="Associated Programs"
            value={`${tier.programIds.length} program${tier.programIds.length === 1 ? "" : "s"}`}
          />
        </section>
      )}

      {/* Timestamps */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Timestamps
        </h3>
        <div className="space-y-3">
          <DetailRow label="Created" value={formatDateTime(tier.createdDateTime) ?? "\u2014"} />
          <DetailRow
            label="Last Modified"
            value={formatDateTime(tier.modifiedDateTime) ?? "\u2014"}
          />
        </div>
      </section>

      {/* Extended Fields Section (from data model extensions) */}
      {schema && extendedFields.length > 0 && (
        <ExtendedFieldsSection
          schema={schema}
          fields={extendedFields}
          data={tier}
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
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
          {canEdit && onEdit && (
            <Button variant="primary-gradient" className="flex-1" onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" />
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
}

function DetailRow({ label, value, mono }: DetailRowProps) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className={mono ? "text-foreground font-mono text-sm" : "text-foreground font-medium"}>
        {value}
      </p>
    </div>
  );
}
