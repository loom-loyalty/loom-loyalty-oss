/**
 * Expression Summary
 *
 * Read-only display of expression trees with human-readable summary
 * and collapsible raw JSON view. Recognizes all 28+ expression types
 * and summarizes actions.
 */

import { Check, Code, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "../lib/utils.js";
import { Badge } from "../primitives/badge.js";
import { Button } from "../primitives/button.js";
import { getActionCategoryColor } from "./action-category-colors.js";
import {
  getComparisonFamilyKind,
  isAnniversaryMatch,
  isComparisonFamilyType,
  OPERATOR_SENTENCE_LABELS,
  type ComparisonFamilyType,
} from "./expression-transition.js";
import { pathToBreadcrumbs } from "./inputs/json-path-input.js";
import { ACTION_TYPE_NAMES } from "./utils.js";

export interface ExpressionSummaryProps {
  expression?: Record<string, unknown> | null;
  label: string;
  className?: string;
  /**
   * Plain-English prose ("Applies when order total is more than $100 and
   * currency is USD.") instead of the formal type-name + raw-path summary
   * (design reference: "Expression design modal redesign"). Opt-in — every
   * existing consumer (Audiences, Campaigns, the wizard step summaries)
   * keeps today's summary unchanged; only `ExpressionModal`'s always-visible
   * preview sets this.
   */
  friendly?: boolean;
  /** Schema-resolved field label from a live sentence-mode picker, when available. */
  resolveFieldName?: (path: string) => string | undefined;
  /**
   * Whether the tree the caller is about to save is actually valid — the
   * modal's combined tree-validation + unresolved-path gate (the same
   * signal that drives its Save button), NOT recomputed here. Defaults to
   * `true` so existing non-modal `friendly` callers (none currently pass
   * this) are unaffected. Gates the "Structure valid" checkmark in
   * friendly mode — it must not claim validity when it isn't (Codex review
   * F10: the checkmark rendered unconditionally, even for an invalid tree).
   * This label previously read "Preview verified", which overclaimed —
   * structural validity is not the same as an actual human review.
   */
  isValid?: boolean;
}

/** "STORE" / "store_group" -> "Store" / "Store Group"; "?" when unset. */
function metadataTypeLabel(code: unknown): string {
  if (typeof code !== "string" || !code.trim()) return "?";
  return code
    .trim()
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Get a human-readable summary of an expression tree.
 */
function getExpressionSummary(expression?: Record<string, unknown> | null): string {
  if (!expression) {
    return "No expression defined";
  }

  const type = Object.keys(expression)[0] ?? "";
  const data = expression[type] as Record<string, unknown> | undefined;

  switch (type) {
    // Logical
    case "true":
      return "Always applies (no conditions)";
    case "and": {
      const children = data?.children;
      const count = Array.isArray(children) ? children.length : 0;
      return `AND: all ${count} condition${count !== 1 ? "s" : ""} must be met`;
    }
    case "or": {
      const children = data?.children;
      const count = Array.isArray(children) ? children.length : 0;
      return `OR: any of ${count} condition${count !== 1 ? "s" : ""} can be met`;
    }
    case "not": {
      const children = data?.children;
      const count = Array.isArray(children) ? children.length : 0;
      return `NOT: negates ${count} condition${count !== 1 ? "s" : ""}`;
    }

    // Equality
    case "equals":
      return `Equals: ${data?.path ?? "?"} = ${String(data?.value ?? "?")}`;
    case "notEquals":
      return `Not Equals: ${data?.path ?? "?"} != ${String(data?.value ?? "?")}`;

    // Numeric
    case "greaterThan":
      return `Greater Than: ${data?.path ?? "?"} > ${data?.value ?? "?"}`;
    case "greaterThanEquals":
      return `Greater Than or Equal: ${data?.path ?? "?"} >= ${data?.value ?? "?"}`;
    case "lessThan":
      return `Less Than: ${data?.path ?? "?"} < ${data?.value ?? "?"}`;
    case "lessThanEquals":
      return `Less Than or Equal: ${data?.path ?? "?"} <= ${data?.value ?? "?"}`;
    case "between":
      return `Between: ${data?.path ?? "?"} in [${data?.lowerBound ?? "?"}, ${data?.upperBound ?? "?"}]`;

    // String
    case "startsWith":
      return `Starts With: ${data?.path ?? "?"} starts with "${data?.value ?? "?"}"`;
    case "endsWith":
      return `Ends With: ${data?.path ?? "?"} ends with "${data?.value ?? "?"}"`;
    case "matches":
      return `Matches: ${data?.path ?? "?"} matches /${data?.value ?? "?"}/`;
    case "empty":
      return `Is Empty: ${data?.path ?? "?"}`;
    case "notEmpty":
      return `Is Not Empty: ${data?.path ?? "?"}`;

    // Collection
    case "in": {
      const values = data?.values;
      const count = Array.isArray(values) ? values.length : 0;
      return `In: ${data?.path ?? "?"} in [${count} values]`;
    }
    case "notIn": {
      const values = data?.values;
      const count = Array.isArray(values) ? values.length : 0;
      return `Not In: ${data?.path ?? "?"} not in [${count} values]`;
    }
    case "containsAny": {
      const values = data?.values;
      const count = Array.isArray(values) ? values.length : 0;
      return `Contains Any: ${data?.path ?? "?"} contains any of [${count} values]`;
    }
    case "containsAll": {
      const values = data?.values;
      const count = Array.isArray(values) ? values.length : 0;
      return `Contains All: ${data?.path ?? "?"} contains all of [${count} values]`;
    }

    // Meta
    case "exists":
      return `Exists: ${data?.path ?? "?"}`;
    case "notExists":
      return `Not Exists: ${data?.path ?? "?"}`;

    // Domain
    case "hasBadge":
      return `Has Badge: ${data?.badgeId ?? "?"}`;
    case "currentTier":
      return `Current Tier: ${data?.tierCode ?? data?.tierId ?? "?"}`;
    case "targetCompleted":
      return `Target Completed: ${data?.targetId ?? "?"}`;
    case "hasProgramCurrency":
      return `Has Currency: ${data?.programCurrencyCode ?? "?"}${data?.comparisonAmount ? ` (min: ${data.comparisonAmount})` : ""}`;

    // Metadata hierarchy (event-only)
    case "isMetadataType":
      return `Is Metadata: ${metadataTypeLabel(data?.metadataTypeCode)}${data?.metadataCode ? ` is ${String(data.metadataCode)}` : ""}`;
    case "inMetadataGroup":
      return `In Metadata Group: ${metadataTypeLabel(data?.metadataTypeCode)} is in group ${String(data?.metadataGroupCode || "?")}`;
    case "isChildMetadata":
      return `Is Child Metadata: ${metadataTypeLabel(data?.metadataTypeCode)} is ${data?.directOnly ? "directly under" : "under"} ${metadataTypeLabel(data?.parentTypeCode)} ${String(data?.parentCode || "?")}`;

    // Event behavior (audience-only)
    case "eventCount":
      return `Event Count: ${data?.eventTypeCode ?? "?"} ≥ ${data?.minCount ?? "?"}${data?.windowDays ? ` in ${data.windowDays}d` : ""}`;
    case "eventSum":
      return `Event Sum: ${data?.eventTypeCode ?? "?"}.${data?.fieldPath ?? "?"} ≥ ${data?.minSum ?? "?"}`;
    case "eventExists":
      return `Event Occurred: ${data?.eventTypeCode ?? "?"}${data?.windowDays ? ` in ${data.windowDays}d` : ""}`;
    case "lastEventTime":
      return `Last Event Within: ${data?.eventTypeCode ?? "?"} in ${data?.maxDaysSinceLast ?? "?"}d`;
    case "funnelStage":
      return `Funnel Stage: ${data?.stage ?? "?"}`;

    default:
      return `Expression: ${type}`;
  }
}

/** Best-effort friendly field name from a raw path — the last breadcrumb
 * segment (e.g. "$.eventData.customer.address.zipCode" -> "ZIP Code"),
 * matching the same heuristic the sentence-mode field pill and card-mode
 * breadcrumb use elsewhere. Not schema-resolved (the summary has no schema
 * access), but consistent with how the rest of the UI already degrades. */
function friendlyFieldName(
  path: unknown,
  resolveFieldName?: (path: string) => string | undefined
): string {
  if (typeof path !== "string") return "this field";
  const resolvedName = resolveFieldName?.(path);
  if (resolvedName) return resolvedName;
  const crumbs = pathToBreadcrumbs(path);
  if (!crumbs || crumbs.length === 0) return "this field";
  return crumbs[crumbs.length - 1]!.label;
}

function formatFriendlyValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "…";
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  return String(value);
}

function friendlyComparisonPhrase(
  type: ComparisonFamilyType,
  data: Record<string, unknown>,
  resolveFieldName?: (path: string) => string | undefined
): string {
  const field = friendlyFieldName(data.path, resolveFieldName);
  if (isAnniversaryMatch(type, data)) {
    return `${field} ${type === "equals" ? "is" : "is not"} today (month and day)`;
  }
  const { needsIs, label } = OPERATOR_SENTENCE_LABELS[type];
  const connector = needsIs ? `is ${label}` : label;
  const kind = getComparisonFamilyKind(type);
  if (kind === "between") {
    return `${field} ${connector} ${formatFriendlyValue(data.lowerBound)} and ${formatFriendlyValue(data.upperBound)}`;
  }
  if (kind === "collection") {
    return `${field} ${connector} ${formatFriendlyValue(data.values)}`;
  }
  return `${field} ${connector} ${formatFriendlyValue(data.value)}`;
}

function friendlyConditionPhrase(
  expression: Record<string, unknown>,
  resolveFieldName?: (path: string) => string | undefined
): string {
  const type = Object.keys(expression)[0] ?? "";
  const data = (expression[type] ?? {}) as Record<string, unknown>;

  if (type === "and" || type === "or" || type === "not") {
    const children = Array.isArray(data.children)
      ? (data.children as Record<string, unknown>[])
      : [];
    if (children.length === 0) return "no conditions yet";
    const childPhrases = children.map((child) => friendlyConditionPhrase(child, resolveFieldName));
    if (type === "not") return `not (${childPhrases.join(" and ")})`;
    return childPhrases.join(type === "and" ? " and " : " or ");
  }
  if (isComparisonFamilyType(type)) {
    return friendlyComparisonPhrase(type, data, resolveFieldName);
  }
  // Specialized types (hasBadge, eventCount, …): fall back to the formal
  // summary, stripped of its "TypeName: " prefix so it still reads as prose
  // inside the surrounding "Applies when …" sentence.
  const formal = getExpressionSummary({ [type]: data });
  const colonIndex = formal.indexOf(": ");
  return colonIndex === -1 ? formal : formal.slice(colonIndex + 2);
}

/** Plain-English restatement of the whole tree (design reference turns 1a/2a/3a). */
function getFriendlySummary(
  expression?: Record<string, unknown> | null,
  resolveFieldName?: (path: string) => string | undefined
): string {
  if (!expression) return "No conditions defined yet.";
  return `Applies when ${friendlyConditionPhrase(expression, resolveFieldName)}.`;
}

/**
 * Get action summary for an expression.
 */
function getActionsSummary(
  expression?: Record<string, unknown> | null
): { count: number; types: string[] } | null {
  if (!expression) return null;
  const type = Object.keys(expression)[0] ?? "";
  const data = expression[type] as Record<string, unknown> | undefined;
  const actions = data?.actions;
  if (!Array.isArray(actions) || actions.length === 0) return null;

  return {
    count: actions.length,
    types: actions.map((action) => Object.keys(action as Record<string, unknown>)[0] ?? ""),
  };
}

export function ExpressionSummary({
  expression,
  label,
  className,
  friendly,
  resolveFieldName,
  isValid = true,
}: ExpressionSummaryProps): ReactNode {
  const [showJson, setShowJson] = useState(false);
  const summary = friendly
    ? getFriendlySummary(expression, resolveFieldName)
    : getExpressionSummary(expression);
  const actionsSummary = getActionsSummary(expression);

  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{label}</h4>
        {!!expression && (
          <Button variant="ghost" size="sm" onClick={() => setShowJson(!showJson)}>
            <Code className="mr-2 h-4 w-4" />
            {showJson ? "Summary" : "JSON"}
          </Button>
        )}
      </div>

      {!showJson ? (
        <div className="mt-1 space-y-1">
          {friendly ? (
            <div
              data-testid="friendly-preview"
              className="bg-muted flex items-center gap-2 rounded-lg px-3 py-2.5"
            >
              {isValid ? (
                <span
                  role="img"
                  className="bg-success/15 text-success-dark flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  aria-label="Structure valid"
                >
                  <Check className="h-3 w-3" aria-hidden="true" />
                </span>
              ) : (
                <span
                  role="img"
                  className="bg-destructive/15 text-destructive flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  aria-label="Structure incomplete"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </span>
              )}
              <p className="text-muted-foreground text-sm">{summary}</p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{summary}</p>
          )}
          {!!actionsSummary && (
            <div className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
              <span>
                {actionsSummary.count} action{actionsSummary.count === 1 ? "" : "s"}:
              </span>
              <div className="flex flex-wrap gap-1">
                {actionsSummary.types.map((type, index) => (
                  <span key={`${type}-${index}`} className="flex items-center gap-1">
                    <span
                      className={cn(getActionCategoryColor(type), "h-3 w-0.5 rounded-full")}
                      aria-hidden="true"
                    />
                    <Badge variant="outline" className="text-[11px]">
                      {ACTION_TYPE_NAMES[type] ?? (type || "Unknown action")}
                    </Badge>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <pre className="bg-muted mt-2 max-h-64 overflow-auto rounded-lg p-4 text-xs">
          <code>{JSON.stringify(expression, null, 2)}</code>
        </pre>
      )}
    </div>
  );
}
