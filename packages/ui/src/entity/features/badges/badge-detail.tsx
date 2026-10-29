/**
 * Badge Detail Sheet Content
 *
 * Displays all Badge fields with Edit and Delete action buttons.
 * Supports extended fields from data model extensions.
 */

import { formatDateTime } from "@loom-loyalty/core";
import type { UIEntitySchema } from "@loom-loyalty/schema";
import type { Badge as BadgeEntity } from "@loom-loyalty/sdk";
import { Edit, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import { EnvironmentEnablementList } from "../../environment-workflow/environment-status-column.js";
import { ExtendedFieldsSection } from "../../extended-fields-section.js";
import { formatDurationPeriod } from "../../format-duration-period.js";
import { getBadgeType, getDescription } from "./badge-columns.js";

export interface BadgeDetailProps {
  /** Badge to display */
  badge: BadgeEntity;
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
 * Badge detail content for Sheet display
 */
export function BadgeDetail({
  badge,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  schema,
  extendedFields = [],
}: BadgeDetailProps): ReactNode {
  const description = getDescription(badge.description);
  const badgeType = getBadgeType(badge);

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Basic Information
        </h3>
        <div className="space-y-3">
          <DetailRow label="Name" value={badge.name} />
          <DetailRow label="Code" value={badge.code} mono />
          {description && <DetailRow label="Description" value={description} />}
          <div>
            <p className="text-muted-foreground text-sm">Type</p>
            {badgeType ? (
              <Badge variant="secondary" className="mt-1 font-normal">
                {badgeType.name ?? badgeType.code}
              </Badge>
            ) : (
              <p className="text-foreground font-medium">{"\u2014"}</p>
            )}
          </div>
        </div>
      </section>

      {/* Badge Configuration */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Badge Configuration
        </h3>
        <div className="space-y-3">
          <DetailRow label="Rank" value={badge.rank != null ? String(badge.rank) : "\u2014"} />
          {(() => {
            const duration = formatDurationPeriod(badge.durationPeriod);
            return duration && <DetailRow label="Duration" value={duration} />;
          })()}
        </div>
      </section>

      {/* Programs */}
      {badge.programIds && badge.programIds.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Programs
          </h3>
          <DetailRow
            label="Associated Programs"
            value={`${badge.programIds.length} program${badge.programIds.length === 1 ? "" : "s"}`}
          />
        </section>
      )}

      {/* Environments */}
      {badge.enabledInEnvironments && badge.enabledInEnvironments.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Enabled Environments
          </h3>
          <EnvironmentEnablementList enabledInEnvironments={badge.enabledInEnvironments} />
        </section>
      )}

      {/* Timestamps */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Timestamps
        </h3>
        <div className="space-y-3">
          <DetailRow label="Created" value={formatDateTime(badge.createdDateTime) ?? "\u2014"} />
          <DetailRow
            label="Last Modified"
            value={formatDateTime(badge.modifiedDateTime) ?? "\u2014"}
          />
        </div>
      </section>

      {/* ID (if available) */}
      {badge.badgeId && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">System</h3>
          <DetailRow label="Badge ID" value={badge.badgeId} mono />
        </section>
      )}

      {/* Extended Fields Section (from data model extensions) */}
      {schema && extendedFields.length > 0 && (
        <ExtendedFieldsSection
          schema={schema}
          fields={extendedFields}
          data={badge}
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
