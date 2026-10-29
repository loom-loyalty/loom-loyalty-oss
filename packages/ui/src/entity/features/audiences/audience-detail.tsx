/**
 * Audience Detail Sheet Content
 *
 * Displays all CustomerAudience fields with Edit and Delete action buttons.
 * Supports type-specific sections for CustomerList, ClickHouse, and THREADS segments.
 */

import { extractLocalizedString, formatDateTime, toISODateTime } from "@loom-loyalty/core";
import type { SegmentExpressionHistory } from "@loom-loyalty/sdk";
import { Edit, ExternalLink, PlayCircle, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import { AudienceStatusIndicator } from "./audience-status-indicator.js";
import { SegmentVersionStatusBadge } from "./segment-version-status-badge.js";
import { TypedAudienceBadge } from "./typed-audience-badge.js";
import {
  isClickHouseSegment,
  isCustomerList,
  isCustomerSegment,
  isThreadsSegment,
  type ClickHouseConfig,
  type CustomerAudience,
  type ThreadsConfig,
} from "./types.js";
import {
  banditStatusLabels,
  formatConfidenceScore,
  formatCronExpression,
  formatLastUpdate,
  formatMemberCount,
  formatMemberCountChange,
  getAudienceMemberCount,
  getSegmentComputationNote,
  getTopBehaviors,
} from "./utils.js";

/** "STALE" -> "Stale" — healthStatus is an uppercase enum on the wire. */
function formatHealthStatus(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export interface AudienceDetailProps {
  /** Audience to display */
  audience: CustomerAudience;
  /** Edit click handler */
  onEdit?: () => void;
  /** Delete click handler */
  onDelete?: () => void;
  /** Handler for "View Full Detail" (THREADS segments) */
  onViewFullDetail?: () => void;
  /**
   * Publish click handler — CUSTOMER_SEGMENT only. A DRAFT segment is never
   * scheduled for analytics computation (segment membership) until
   * published; this button is the only way to do that from the Hub.
   */
  onPublish?: () => void;
  /** Whether editing is enabled */
  canEdit?: boolean;
  /** Whether deletion is enabled */
  canDelete?: boolean;
  /** True while the publish mutation is in flight */
  isPublishing?: boolean;
  /** Inline error for the publish action (rendered above the action buttons) */
  publishError?: string | null;
  /**
   * Create Version click handler — CUSTOMER_SEGMENT only. Creates a new DRAFT
   * version from the segment's current PUBLISHED expression; the backend
   * rejects this unless the segment is currently PUBLISHED (the mirror image
   * of the constraint the Publish endpoint already enforces).
   */
  onCreateVersion?: () => void;
  /** True while the create-version mutation is in flight */
  isCreatingVersion?: boolean;
  /** Inline error for the create-version action (rendered above the action buttons) */
  createVersionError?: string | null;
  /**
   * Prior expression versions for a segment (`GET
   * /customer-audiences/{id}/versions`). Unlike DataModel's version history,
   * `SegmentExpressionHistory` carries no `versionStatus` field at all (only
   * version/createdDateTime/segmentExpression/referencedFields/computationCost),
   * so this only ever renders version number, created date, and referenced
   * fields — no per-row status badge, no per-row publish action.
   */
  versionHistory?: SegmentExpressionHistory[];
}

/**
 * Audience detail content for Sheet display
 */
export function AudienceDetail({
  audience,
  onEdit,
  onDelete,
  onViewFullDetail,
  onPublish,
  onCreateVersion,
  canEdit = true,
  canDelete = true,
  isPublishing = false,
  isCreatingVersion = false,
  publishError,
  createVersionError,
  versionHistory = [],
}: AudienceDetailProps): ReactNode {
  const description = extractLocalizedString(audience.description);
  // Only a CUSTOMER_SEGMENT has a version lifecycle — CUSTOMER_LIST is a
  // static list with no draft/published concept at all.
  const isSegment = isCustomerSegment(audience);
  const isDraftSegment = isSegment && audience.versionStatus === "DRAFT";
  // Create Version's availability is the mirror image of Publish's: a
  // PUBLISHED segment can spawn a new DRAFT, a DRAFT cannot (the backend
  // 400s "Segment is not in PUBLISHED status" otherwise).
  const isPublishedSegment = isSegment && audience.versionStatus === "PUBLISHED";
  const computationNote = getSegmentComputationNote(audience);

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Basic Information
        </h3>
        <div className="space-y-3">
          <DetailRow label="Name" value={audience.name} />
          <DetailRow label="Code" value={audience.code} mono />
          {description && <DetailRow label="Description" value={description} />}
          <div>
            <p className="text-muted-foreground text-sm">Type</p>
            <div className="mt-1">
              <TypedAudienceBadge audience={audience} size="sm" />
            </div>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Status</p>
            <div className="mt-1">
              <AudienceStatusIndicator audience={audience} />
            </div>
          </div>
          {isCustomerSegment(audience) && audience.versionStatus && (
            <div>
              <p className="text-muted-foreground text-sm">Version</p>
              <div className="mt-1 flex items-center gap-2">
                {typeof audience.version === "number" && (
                  <span className="text-foreground font-mono text-xs">v{audience.version}</span>
                )}
                <SegmentVersionStatusBadge status={audience.versionStatus} />
              </div>
            </div>
          )}
          {isCustomerSegment(audience) && audience.healthStatus && (
            <DetailRow label="Health Status" value={formatHealthStatus(audience.healthStatus)} />
          )}
          <DetailRow
            label="Trigger On Enter"
            value={audience.triggerOnEnter ? "Enabled" : "Disabled"}
          />
          <DetailRow
            label="Trigger On Exit"
            value={audience.triggerOnExit ? "Enabled" : "Disabled"}
          />
        </div>
      </section>

      {/* Type-specific section: Customer List */}
      {isCustomerList(audience) && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Membership
          </h3>
          <div className="space-y-3">
            <DetailRow
              label="Member Count"
              value={formatMemberCount(getAudienceMemberCount(audience))}
            />
          </div>
        </section>
      )}

      {/* Membership for a Platform API segment (no engine config): the count
          from its last computation run, and when that run happened. */}
      {isSegment && !isClickHouseSegment(audience) && !isThreadsSegment(audience) && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Membership
          </h3>
          <div className="space-y-3">
            <DetailRow
              label="Member Count"
              value={formatMemberCount(getAudienceMemberCount(audience))}
            />
            {computationNote && <DetailRow label="Computation" value={computationNote} />}
          </div>
        </section>
      )}

      {/* Type-specific section: ClickHouse Segment */}
      {isClickHouseSegment(audience) && (
        <ClickHouseSection
          config={audience.engineConfig}
          memberCount={getAudienceMemberCount(audience)}
        />
      )}

      {/* Type-specific section: THREADS Segment */}
      {isThreadsSegment(audience) && (
        <ThreadsSection
          config={audience.engineConfig}
          memberCount={getAudienceMemberCount(audience)}
          onViewFullDetail={onViewFullDetail}
        />
      )}

      {/* Version History — CUSTOMER_SEGMENT only, display-only. See
          SegmentVersionHistorySection's doc comment for why this can't mirror
          DataModel's per-row-status version history. */}
      {isSegment && versionHistory.length > 0 && (
        <SegmentVersionHistorySection versions={versionHistory} />
      )}

      {/* Timestamps */}
      <section className="space-y-4">
        <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Timestamps
        </h3>
        <div className="space-y-3">
          <DetailRow
            label="Created"
            value={formatDateTime(audience.createdAt) ?? "\u2014"}
            dateTime={audience.createdAt}
          />
          <DetailRow
            label="Last Modified"
            value={formatDateTime(audience.updatedAt) ?? "\u2014"}
            dateTime={audience.updatedAt}
          />
        </div>
      </section>

      {/* ID (if available) */}
      {audience.customerAudienceId && (
        <section className="space-y-4">
          <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">System</h3>
          <DetailRow label="Audience ID" value={audience.customerAudienceId} mono />
        </section>
      )}

      {publishError && (
        <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-3" role="alert">
          <p className="text-destructive text-sm">{publishError}</p>
        </div>
      )}

      {createVersionError && (
        <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-3" role="alert">
          <p className="text-destructive text-sm">{createVersionError}</p>
        </div>
      )}

      {/* Action Buttons */}
      {(canEdit || canDelete || (canEdit && isDraftSegment && onPublish)) && (
        <div className="border-border flex gap-2 border-t pt-4">
          {canDelete && onDelete && (
            <Button variant="outline" className="flex-1" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
          {canEdit && isDraftSegment && onPublish && (
            <Button
              variant="outline"
              className="text-success-dark flex-1"
              onClick={onPublish}
              disabled={isPublishing}
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              {isPublishing ? "Publishing…" : "Publish"}
            </Button>
          )}
          {canEdit && isPublishedSegment && onCreateVersion && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={onCreateVersion}
              disabled={isCreatingVersion}
            >
              <Plus className="mr-2 h-4 w-4" />
              {isCreatingVersion ? "Creating…" : "New Version"}
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

// ============================================================================
// Sub-components
// ============================================================================

function ClickHouseSection({
  config,
  memberCount,
}: {
  config: ClickHouseConfig;
  memberCount: number | null;
}): ReactNode {
  return (
    <section className="space-y-4">
      <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
        Query Configuration
      </h3>
      <div className="space-y-3">
        {/* Query definition in code block */}
        <div>
          <p className="text-muted-foreground text-sm">Query Definition</p>
          <pre className="bg-muted text-foreground mt-1 overflow-x-auto rounded-md p-3 font-mono text-xs">
            {config.queryDefinition}
          </pre>
        </div>
        {config.refreshInterval && (
          <DetailRow
            label="Refresh Interval"
            value={formatCronExpression(config.refreshInterval)}
          />
        )}
        {config.lastQueryRun && (
          <DetailRow label="Last Run" value={formatLastUpdate(config.lastQueryRun)} />
        )}
        <DetailRow label="Member Count" value={formatMemberCount(memberCount)} />
        {config.lastMemberCountChange != null && config.lastMemberCountChange !== 0 && (
          <DetailRow
            label="Member Change"
            value={formatMemberCountChange(config.lastMemberCountChange)}
          />
        )}
      </div>
    </section>
  );
}

function ThreadsSection({
  config,
  memberCount,
  onViewFullDetail,
}: {
  config: ThreadsConfig;
  memberCount: number | null;
  onViewFullDetail?: () => void;
}): ReactNode {
  return (
    <section className="space-y-4">
      <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
        AI Segment Details
      </h3>
      <div className="space-y-3">
        <DetailRow label="Confidence Score" value={formatConfidenceScore(config.confidenceScore)} />
        <DetailRow label="AI Name" value={config.aiGeneratedName} />
        <div>
          <p className="text-muted-foreground text-sm">Bandit Status</p>
          <Badge variant="secondary" className="mt-1 font-normal">
            {banditStatusLabels[config.banditStatus]}
          </Badge>
        </div>
        <DetailRow label="Member Count" value={formatMemberCount(memberCount)} />

        {/* Top 3 behaviors */}
        {config.contributingBehaviors.length > 0 && (
          <div>
            <p className="text-muted-foreground text-sm">Top Behaviors</p>
            <ul className="mt-1 space-y-1">
              {getTopBehaviors(config.contributingBehaviors, 3).map((behavior) => (
                <li
                  key={behavior.behaviorTag}
                  className="text-foreground flex items-center justify-between text-sm"
                >
                  <span>{behavior.description}</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {Math.round(behavior.contributionWeight * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* View Full Detail link */}
        {onViewFullDetail && (
          <Button variant="outline" size="sm" onClick={onViewFullDetail} className="mt-2 w-full">
            <ExternalLink className="mr-2 h-4 w-4" />
            View Full Detail
          </Button>
        )}
      </div>
    </section>
  );
}

/**
 * Thinner, display-only version history for a CustomerSegment's expression
 * history (`GET /customer-audiences/{id}/versions`). Deliberately NOT a
 * mirror of the DataModel feature's `VersionHistorySection`: that component
 * renders a per-row status badge and gates a per-row Publish button on each
 * entry's `versionStatus`, but `SegmentExpressionHistory` (confirmed in
 * openapi.yaml) carries no `versionStatus` field at all — there is nothing
 * to badge or gate per row. This renders version number, created date, and
 * referenced fields only. Publish stays exactly where it already is in the
 * action-buttons row above, gated on the segment's own `isDraftSegment`.
 */
function SegmentVersionHistorySection({
  versions,
}: {
  versions: SegmentExpressionHistory[];
}): ReactNode {
  const sorted = [...versions].sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
  return (
    <section className="space-y-4">
      <h3 className="text-foreground text-sm font-semibold tracking-wide uppercase">
        Version History ({versions.length})
      </h3>
      <div className="border-border overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr className="border-chrome-border border-b">
              <th
                scope="col"
                className="text-chrome-muted-foreground px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase"
              >
                Version
              </th>
              <th
                scope="col"
                className="text-chrome-muted-foreground px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase"
              >
                Created
              </th>
              <th
                scope="col"
                className="text-chrome-muted-foreground px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase"
              >
                Referenced Fields
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry) => (
              <tr key={entry.segmentExpressionHistoryId} className="border-border/60 border-t">
                <td className="text-foreground px-3 py-2 font-mono text-xs">v{entry.version}</td>
                <td className="text-muted-foreground px-3 py-2 text-xs">
                  <time dateTime={toISODateTime(new Date(entry.createdDateTime)) ?? ""}>
                    {formatDateTime(entry.createdDateTime) ?? "—"}
                  </time>
                </td>
                <td className="text-muted-foreground px-3 py-2 text-xs">
                  {entry.referencedFields && entry.referencedFields.length > 0
                    ? entry.referencedFields.join(", ")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
  mono?: boolean;
  /** ISO date string — renders value in a <time> element when provided */
  dateTime?: string;
}

function DetailRow({ label, value, mono, dateTime }: DetailRowProps) {
  const textClass = mono ? "text-foreground font-mono text-sm" : "text-foreground font-medium";
  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      {dateTime ? (
        <time dateTime={dateTime} className={textClass}>
          {value}
        </time>
      ) : (
        <p className={textClass}>{value}</p>
      )}
    </div>
  );
}
