/**
 * Read-only version history for one event rule: every version of
 * the rule's code, newest first, with its status and when it last changed.
 * Lists never show old versions, so this is the one place they appear. Below
 * the list, a compare view shows what changed between two versions (fe#1933):
 * only the groups that changed, each with Before and After. It offers no
 * actions; old versions can't be made live.
 */

import { formatDateTime } from "@loom-loyalty/core";
import { useId, useMemo, useState, type ReactNode } from "react";

import { ExpressionSummary } from "../../../expressions/expression-summary.js";
import { normalizeExpression } from "../../../expressions/migrate.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../primitives/dialog.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../primitives/select.js";
import { Skeleton } from "../../../primitives/skeleton.js";
import type { EntityRecord } from "../../entity-list.js";
import { StatusIndicatorBadge } from "../../status-indicator-badge.js";
import { toEventRuleVersionStatus } from "./event-rule-actions.js";
import {
  defaultComparePair,
  diffEventRuleVersions,
  versionOf,
  type EventRuleDiffGroup,
} from "./event-rule-version-diff.js";
import { EVENT_RULE_VERSION_INDICATOR_INFO, type EventRuleVersionIndicator } from "./types.js";

export interface EventRuleVersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruleName: string;
  versions: EntityRecord[];
  isLoading?: boolean;
  error?: string | null;
}

export function EventRuleVersionHistoryDialog({
  open,
  onOpenChange,
  ruleName,
  versions,
  isLoading,
  error,
}: EventRuleVersionHistoryDialogProps): ReactNode {
  const sorted = [...versions].sort(
    (a, b) => ((b.version as number | undefined) ?? 0) - ((a.version as number | undefined) ?? 0)
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Version history</DialogTitle>
          <DialogDescription>
            Every version of {ruleName}, newest first. Old versions are read-only.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : isLoading ? (
          <div className="space-y-2" role="status" aria-busy="true">
            <span className="sr-only">Loading version history</span>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-muted-foreground text-sm">No versions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-left">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Version
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Status
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Name
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Last changed
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((version) => {
                  const modified = version.modifiedDateTime as string | undefined;
                  return (
                    <tr
                      key={(version.eventRuleId as string | undefined) ?? String(version.version)}
                      className="border-border border-b last:border-0"
                    >
                      <td className="text-foreground py-2 pr-4 font-mono">
                        v{String(version.version ?? "?")}
                      </td>
                      <td className="py-2 pr-4">
                        <StatusIndicatorBadge
                          config={
                            EVENT_RULE_VERSION_INDICATOR_INFO[indicatorFor(version.versionStatus)]
                          }
                          ariaLabelPrefix={`Version ${String(version.version ?? "")} status`}
                        />
                      </td>
                      <td className="text-foreground py-2 pr-4">{String(version.name ?? "")}</td>
                      <td className="text-muted-foreground py-2">
                        {modified ? (
                          <time dateTime={modified}>{formatDateTime(modified)}</time>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!error && !isLoading && sorted.length > 1 && <VersionCompare versions={sorted} />}
      </DialogContent>
    </Dialog>
  );
}

function indicatorFor(versionStatus: unknown): EventRuleVersionIndicator {
  const status = toEventRuleVersionStatus(versionStatus);
  return status ? (status.toLowerCase() as EventRuleVersionIndicator) : "unknown";
}

/** Picks two versions and shows the groups that changed between them. */
function VersionCompare({ versions }: { versions: EntityRecord[] }): ReactNode {
  const initial = useMemo(() => defaultComparePair(versions), [versions]);
  const [beforeVersion, setBeforeVersion] = useState<number | undefined>(
    initial ? versionOf(initial.before) : undefined
  );
  const [afterVersion, setAfterVersion] = useState<number | undefined>(
    initial ? versionOf(initial.after) : undefined
  );
  const olderId = useId();
  const newerId = useId();
  // A version deleted since the dialog opened falls back to the default pair.
  const before =
    versions.find((v) => versionOf(v) === beforeVersion) ?? initial?.before ?? undefined;
  const after = versions.find((v) => versionOf(v) === afterVersion) ?? initial?.after ?? undefined;
  const groups = useMemo(
    () => (before && after ? diffEventRuleVersions(before, after) : []),
    [before, after]
  );
  if (!before || !after) return null;
  const beforeLabel = `v${versionOf(before)}`;
  const afterLabel = `v${versionOf(after)}`;
  const changed = groups.filter((group) => group.changed);
  const unchanged = groups.filter((group) => !group.changed);

  return (
    <section aria-labelledby={`${olderId}-title`} className="border-border space-y-4 border-t pt-4">
      <h2 id={`${olderId}-title`} className="text-foreground text-sm font-semibold">
        Compare versions
      </h2>
      <div className="flex flex-wrap items-end gap-4">
        <VersionPicker
          id={olderId}
          label="Older version"
          versions={versions.filter((v) => versionOf(v) < versionOf(after))}
          value={versionOf(before)}
          onChange={setBeforeVersion}
        />
        <VersionPicker
          id={newerId}
          label="Newer version"
          versions={versions.filter((v) => versionOf(v) > versionOf(before))}
          value={versionOf(after)}
          onChange={setAfterVersion}
        />
      </div>
      {versionOf(before) === versionOf(after) ? (
        <p className="text-muted-foreground text-sm">Pick two different versions to compare.</p>
      ) : changed.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No content changes between {afterLabel} and {beforeLabel}.
        </p>
      ) : (
        <div className="space-y-4">
          {changed.map((group) => (
            <ChangedGroup
              key={group.key}
              group={group}
              beforeLabel={beforeLabel}
              afterLabel={afterLabel}
            />
          ))}
          {unchanged.length > 0 && (
            <p className="text-muted-foreground text-sm">
              Unchanged: {unchanged.map((group) => group.label).join(", ")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function VersionPicker({
  id,
  label,
  versions,
  value,
  onChange,
}: {
  id: string;
  label: string;
  versions: EntityRecord[];
  value: number;
  onChange: (version: number) => void;
}): ReactNode {
  return (
    <div className="space-y-1">
      <span id={`${id}-label`} className="text-muted-foreground block text-xs font-medium">
        {label}
      </span>
      <Select value={String(value)} onValueChange={(next) => onChange(Number(next))}>
        <SelectTrigger aria-labelledby={`${id}-label`} className="min-h-11 w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {versions.map((v) => (
            <SelectItem key={versionOf(v)} value={String(versionOf(v))}>
              {`v${versionOf(v)}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ChangedGroup({
  group,
  beforeLabel,
  afterLabel,
}: {
  group: EventRuleDiffGroup;
  beforeLabel: string;
  afterLabel: string;
}): ReactNode {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="border-border rounded-md border p-3">
      <h3 id={headingId} className="text-foreground mb-2 text-sm font-semibold">
        {group.label}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <GroupSide title={`Before (${beforeLabel})`} group={group} fields={group.before} />
        <GroupSide title={`After (${afterLabel})`} group={group} fields={group.after} />
      </div>
    </section>
  );
}

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  description: "Description",
  eventTypeCode: "Event type",
  eventSubTypeIdentifier: "Sub type",
  category: "Category",
  processItemsIndividually: "Process items individually",
  rollUpEventRuleResults: "Roll up event rule results",
  promotionTargetId: "Promotion target",
  occurrenceTargets: "Occurrence targets",
  currencyTargets: "Currency targets",
  programCurrencyTargetsToExclude: "Excluded currency targets",
  programIds: "Programs",
  enabledInEnvironments: "Environments",
};

function GroupSide({
  title,
  group,
  fields,
}: {
  title: string;
  group: EventRuleDiffGroup;
  fields: Record<string, unknown>;
}): ReactNode {
  const expressionField =
    group.key === "conditions"
      ? "eventExpression"
      : group.key === "actions"
        ? "eventActionsExpression"
        : undefined;
  const rest = Object.entries(fields).filter(([field]) => field !== expressionField);
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{title}</p>
      {expressionField && (
        <ExpressionSummary
          expression={
            fields[expressionField]
              ? (normalizeExpression(fields[expressionField]) as unknown as Record<string, unknown>)
              : null
          }
          label={group.label}
          friendly
        />
      )}
      {rest.length > 0 && (
        <dl className="space-y-1 text-sm">
          {rest.map(([field, value]) => (
            <div key={field}>
              <dt className="text-muted-foreground text-xs">{FIELD_LABELS[field] ?? field}</dt>
              <dd className="text-foreground break-words">{formatValue(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function formatValue(value: unknown): ReactNode {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">None</span>;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value.join(", ");
  }
  return (
    <code className="bg-muted block rounded px-2 py-1 font-mono text-xs whitespace-pre-wrap">
      {JSON.stringify(value, null, 2)}
    </code>
  );
}
