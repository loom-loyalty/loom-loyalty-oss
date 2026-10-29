/**
 * Event Rule Detail Sheet Content
 *
 * Read-only detail view for event rules displayed inside a Sheet.
 */

import { extractLocalizedString, formatDateTime } from "@loom-loyalty/core";
import { Edit, PauseCircle, PlayCircle, Plus, RotateCw, Trash2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import type { EntityRecord } from "../../entity-list.js";
import { StatusIndicatorBadge } from "../../status-indicator-badge.js";

import { ExpressionSummary } from "../../../expressions/expression-summary.js";
import { normalizeExpression } from "../../../expressions/migrate.js";
import { useProgramField } from "../../../forms/program-field/index.js";
import {
  EnvironmentEnablementList,
  type EnabledInEnvironment,
} from "../../environment-workflow/environment-status-column.js";
import { EventRuleCategoryBadge } from "./event-rule-category-badge.js";
import {
  CATEGORY_INFO,
  EVENT_RULE_VERSION_INDICATOR_INFO,
  type CurrencyTarget,
  type DetailRowProps,
  type EventRuleCategory,
  type EventRuleVersionIndicator,
  type OccurrenceTarget,
} from "./types.js";

export interface EventRuleDetailProps {
  eventRule: EntityRecord;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  /**
   * Version lifecycle (U3) — mirrors `DataModelDetail`'s optional-prop shape
   * (see `data-model-detail.tsx`). All four are gated behind `canEdit`, same
   * as `onEdit`. Create Version / Pause / Resume are always shown once wired
   * (KTD3's fallback — the schema can't structurally distinguish DRAFT from
   * PAUSED, so gating relies on inline errors from the server instead);
   * Publish is gated by `isConfirmedPublished`.
   */
  onPublish?: () => void;
  onCreateVersion?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  /**
   * Whether this exact record is confirmed (live) to be the event rule's
   * current published version — diffed by the caller against
   * `GET /event-rules/by-code/{code}/latest-published` (KTD3). `undefined`
   * or `false` both render as "not confirmed published" and cover DRAFT,
   * PAUSED, and any non-latest PUBLISHED version alike, since the `EventRule`
   * schema has no field to split those further.
   */
  isConfirmedPublished?: boolean;
  /**
   * Session-scoped refinement of the badge shown when `isConfirmedPublished`
   * is not true: "draft" right after this session's own createVersion
   * succeeds, "paused" right after this session's own pause succeeds.
   * Ignored once `isConfirmedPublished` is true. Falls back to the generic
   * "unknown" indicator when unset — this is never re-derived from a cold
   * read (KTD3; see `EventRuleVersionIndicator`'s doc comment in types.ts).
   */
  recentVersionStatusHint?: "draft" | "paused";
  isPublishing?: boolean;
  isCreatingVersion?: boolean;
  isPausing?: boolean;
  isResuming?: boolean;
  /** Inline error for a rejected version-lifecycle action (KTD3 fallback). */
  versionActionError?: string | null;
}

/**
 * Event rule detail content for Sheet display.
 */
export function EventRuleDetail({
  eventRule,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  onPublish,
  onCreateVersion,
  onPause,
  onResume,
  isConfirmedPublished,
  recentVersionStatusHint,
  isPublishing,
  isCreatingVersion,
  isPausing,
  isResuming,
  versionActionError,
}: EventRuleDetailProps): ReactNode {
  const description = extractLocalizedString(eventRule.description as Record<string, string>);
  const category = eventRule.category as string;

  // Event type resolution
  const eventType = eventRule.eventType as Record<string, unknown> | string | undefined;
  const eventTypeCode = eventRule.eventTypeCode as string | undefined;
  let eventTypeDisplay = "\u2014";
  if (typeof eventType === "object" && eventType !== null) {
    eventTypeDisplay = (eventType.name as string) ?? (eventType.code as string) ?? "\u2014";
  } else if (typeof eventType === "string") {
    eventTypeDisplay = eventType;
  } else if (eventTypeCode) {
    eventTypeDisplay = eventTypeCode;
  }

  // Programs resolution
  const { options: programOptions } = useProgramField();
  const programIds = useMemo(
    () => (eventRule.programIds as string[]) ?? [],
    [eventRule.programIds]
  );
  const resolvedPrograms = useMemo(() => {
    return programIds.map((id) => {
      const program = programOptions.find((p) => p.id === id);
      return { id, name: program?.name ?? id };
    });
  }, [programIds, programOptions]);

  // Targets
  const occurrenceTargets = (eventRule.occurrenceTargets as OccurrenceTarget[]) ?? [];
  const currencyTargets = (eventRule.currencyTargets as CurrencyTarget[]) ?? [];
  const promotionTargetId =
    (eventRule.promotionTargetId as string) ??
    ((eventRule.promotionTarget as Record<string, unknown>)?.targetId as string) ??
    "";

  // Environments
  const envs = (eventRule.enabledInEnvironments as EnabledInEnvironment[] | undefined) ?? [];

  // Expressions. Persisted rules may carry pre-correction field names; normalize
  // before summarizing so legacy `between`/`hasProgramCurrency` etc. render.
  const eventExpression = useMemo(
    () =>
      eventRule.eventExpression
        ? (normalizeExpression(eventRule.eventExpression) as unknown as Record<string, unknown>)
        : null,
    [eventRule.eventExpression]
  );
  const eventActionsExpression = useMemo(
    () =>
      eventRule.eventActionsExpression
        ? (normalizeExpression(eventRule.eventActionsExpression) as unknown as Record<
            string,
            unknown
          >)
        : null,
    [eventRule.eventActionsExpression]
  );

  const showVersionActions = !!(onPublish || onCreateVersion || onPause || onResume);

  return (
    <div className="space-y-6">
      {/* Version status (U3) — mirrors DataModelDetail's header VersionStatusBadge. */}
      {showVersionActions && (
        <div className="flex flex-wrap items-center gap-2">
          <EventRuleVersionStatusBadge
            indicator={
              isConfirmedPublished === true ? "published" : (recentVersionStatusHint ?? "unknown")
            }
          />
        </div>
      )}

      {/* Basic Information */}
      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Basic Information
        </h2>
        <div className="space-y-3">
          <DetailRow label="Name" value={eventRule.name as string} />
          <DetailRow label="Code" value={eventRule.code as string} mono />
          {description && <DetailRow label="Description" value={description} />}
          <div>
            <p className="text-muted-foreground text-sm">Category</p>
            {category && category in CATEGORY_INFO ? (
              <div className="mt-1">
                <EventRuleCategoryBadge category={category as EventRuleCategory} />
              </div>
            ) : (
              <Badge variant="outline" className="mt-1 font-normal">
                {category ?? "\u2014"}
              </Badge>
            )}
          </div>
        </div>
      </section>

      {/* Event Configuration */}
      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Event Configuration
        </h2>
        <div className="space-y-3">
          <DetailRow label="Event Type" value={eventTypeDisplay} />
          <div className="flex gap-4">
            <div>
              <p className="text-muted-foreground text-sm">Process Individually</p>
              <Badge variant="outline" className="mt-1 font-normal">
                {eventRule.processItemsIndividually ? "Yes" : "No"}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Roll Up Results</p>
              <Badge variant="outline" className="mt-1 font-normal">
                {eventRule.rollUpEventRuleResults ? "Yes" : "No"}
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Targets */}
      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">Targets</h2>
        <div className="space-y-3">
          <DetailRow
            label="Promotion Target"
            value={promotionTargetId || "\u2014"}
            mono={!!promotionTargetId}
          />
          <div>
            <p className="text-muted-foreground text-sm">Occurrence Targets</p>
            <p className="text-foreground font-medium">
              {occurrenceTargets.length > 0
                ? `${occurrenceTargets.length} target${occurrenceTargets.length !== 1 ? "s" : ""}`
                : "None"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Currency Targets</p>
            <p className="text-foreground font-medium">
              {currencyTargets.length > 0
                ? `${currencyTargets.length} target${currencyTargets.length !== 1 ? "s" : ""}`
                : "None"}
            </p>
          </div>
        </div>
      </section>

      {/* Event Expression */}
      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Event Expression (WHEN)
        </h2>
        <ExpressionSummary expression={eventExpression} label="Conditions" />
      </section>

      {/* Actions Expression */}
      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Actions Expression (WHAT)
        </h2>
        <ExpressionSummary expression={eventActionsExpression} label="Actions" />
      </section>

      {/* Programs */}
      {resolvedPrograms.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Programs
          </h2>
          <div className="flex flex-wrap gap-2">
            {resolvedPrograms.map((program) => (
              <Badge key={program.id} variant="outline">
                {program.name}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* Environments */}
      {envs.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">
            Enabled Environments
          </h2>
          <EnvironmentEnablementList enabledInEnvironments={envs} />
        </section>
      )}

      {/* Timestamps */}
      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Timestamps
        </h2>
        <div className="space-y-3">
          <DetailRow
            label="Created"
            value={formatDateTime(eventRule.createdDateTime as string) ?? "\u2014"}
          />
          <DetailRow
            label="Last Modified"
            value={formatDateTime(eventRule.modifiedDateTime as string) ?? "\u2014"}
          />
        </div>
      </section>

      {/* System ID */}
      {!!eventRule.eventRuleId && (
        <section className="space-y-4">
          <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">System</h2>
          <DetailRow label="Event Rule ID" value={eventRule.eventRuleId as string} mono />
        </section>
      )}

      {versionActionError && (
        <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-3" role="alert">
          <p className="text-destructive text-sm">{versionActionError}</p>
        </div>
      )}

      {/* Action Buttons */}
      {(canEdit || canDelete || showVersionActions) && (
        <div className="border-border flex flex-wrap gap-2 border-t pt-4">
          {canEdit && onCreateVersion && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCreateVersion}
              disabled={isCreatingVersion}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Version
            </Button>
          )}
          {canEdit && onPublish && isConfirmedPublished !== true && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPublish}
              disabled={isPublishing}
              className="text-success-dark"
            >
              <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
              Publish
            </Button>
          )}
          {canEdit && onPause && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPause}
              disabled={isPausing}
              className="text-warning"
            >
              <PauseCircle className="mr-1.5 h-3.5 w-3.5" />
              Pause
            </Button>
          )}
          {canEdit && onResume && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onResume}
              disabled={isResuming}
              className="text-success-dark"
            >
              <RotateCw className="mr-1.5 h-3.5 w-3.5" />
              Resume
            </Button>
          )}
          <div className="flex-1" />
          {canDelete && onDelete && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          )}
          {canEdit && onEdit && (
            <Button type="button" variant="primary-gradient" size="sm" onClick={onEdit}>
              <Edit className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono }: DetailRowProps): ReactNode {
  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className={mono ? "text-foreground font-mono text-sm" : "text-foreground font-medium"}>
        {value}
      </p>
    </div>
  );
}

function EventRuleVersionStatusBadge({
  indicator,
}: {
  indicator: EventRuleVersionIndicator;
}): ReactNode {
  const config = EVENT_RULE_VERSION_INDICATOR_INFO[indicator];
  return <StatusIndicatorBadge config={config} ariaLabelPrefix="Version status" />;
}
