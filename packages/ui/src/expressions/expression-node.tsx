/**
 * Expression Node
 *
 * Wraps individual expression type components. Shows type badge, expand/collapse,
 * delete button, and dispatches to the correct expression type component.
 */

import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { memo, useCallback, useState, type ReactNode } from "react";
import { Badge } from "../primitives/badge.js";
import { Button } from "../primitives/button.js";
import { Card, CardContent, CardHeader } from "../primitives/card.js";

import { ActionList } from "./action-list";
import { BetweenExpressionComponent } from "./components/between-expression";
import { CollectionContainsExpressionComponent } from "./components/collection-contains-expression";
import { CollectionInExpressionComponent } from "./components/collection-in-expression";
import { ComparisonSentence } from "./components/comparison-sentence";
import { CurrentTierExpressionComponent } from "./components/current-tier-expression";
import { EmptyExpressionComponent } from "./components/empty-expression";
import { EqualityExpressionComponent } from "./components/equality-expression";
import { EventCountExpressionComponent } from "./components/event-count-expression";
import { EventExistsExpressionComponent } from "./components/event-exists-expression";
import { EventSumExpressionComponent } from "./components/event-sum-expression";
import { ExistsExpressionComponent } from "./components/exists-expression";
import { FunnelStageExpressionComponent } from "./components/funnel-stage-expression";
import { HasBadgeExpressionComponent } from "./components/has-badge-expression";
import { HasProgramCurrencyExpressionComponent } from "./components/has-program-currency-expression";
import { LastEventTimeExpressionComponent } from "./components/last-event-time-expression";
import {
  InMetadataGroupExpressionComponent,
  IsChildMetadataExpressionComponent,
  IsMetadataTypeExpressionComponent,
} from "./components/metadata-hierarchy-expression";
import { NumericExpressionComponent } from "./components/numeric-expression";
import { StringExpressionComponent } from "./components/string-expression";
import { TargetCompletedExpressionComponent } from "./components/target-completed-expression";
import { TrueExpressionComponent } from "./components/true-expression";
import { useExpressionContext } from "./expression-context";
import { isComparisonFamilyType, transitionExpressionData } from "./expression-transition";
import type { Expression, ExpressionAction, ExpressionNodeProps } from "./types";
import {
  EXPRESSION_TYPE_NAMES,
  getExpressionActions,
  getExpressionData,
  getExpressionType,
} from "./utils";

// Stable fallback so `actions={actions ?? EMPTY_ACTIONS}` doesn't hand
// ActionList (and its internal useActionSummaryLookups/schema-resolution
// hooks) a fresh empty-array reference on every render of a node with no
// configured actions, defeating ActionList's own memo() (adversarial review
// finding).
const EMPTY_ACTIONS: ExpressionAction[] = [];

export const ExpressionNode = memo(function ExpressionNode({
  expression,
  onChange,
  depth,
  disabled,
  onRemove,
  showActions,
  presentation = "card",
}: ExpressionNodeProps): ReactNode {
  const [expanded, setExpanded] = useState(true);
  const { renderConditionAside } = useExpressionContext();
  const type = getExpressionType(expression);
  const data = getExpressionData(expression);
  const actions = getExpressionActions(expression);

  const handleDataChange = useCallback(
    (newData: Record<string, unknown>) => {
      onChange({ [type]: newData } as unknown as Expression);
    },
    [type, onChange]
  );

  // Operator switching changes the AST's top-level key, so it cannot go
  // through `handleDataChange` above — it uses the pure type-transition
  // function instead (KTD10). Scoped to comparison-family types only; the
  // sentence-mode operator control (`ComparisonSentence`) never offers a
  // non-comparison type as `newType`, so this only ever fires within the
  // comparison family (fix #12).
  const handleTypeChange = useCallback(
    (newType: string) => {
      if (!isComparisonFamilyType(type) || !isComparisonFamilyType(newType)) return;
      const newData = transitionExpressionData(type, newType, data);
      onChange({
        [newType]: actions ? { ...newData, actions } : newData,
      } as unknown as Expression);
    },
    [type, data, actions, onChange]
  );

  const handleActionsChange = useCallback(
    (newActions: ExpressionAction[]) => {
      onChange({
        [type]: { ...data, actions: newActions.length > 0 ? newActions : undefined },
      } as unknown as Expression);
    },
    [type, data, onChange]
  );

  const typeName = EXPRESSION_TYPE_NAMES[type] ?? type;

  const renderExpressionFields = (): ReactNode => {
    const mode = "edit" as const;

    switch (type) {
      case "true":
        return (
          <TrueExpressionComponent
            value={data as Parameters<typeof TrueExpressionComponent>[0]["value"]}
            onChange={handleDataChange as Parameters<typeof TrueExpressionComponent>[0]["onChange"]}
            disabled={disabled}
            mode={mode}
          />
        );
      case "exists":
      case "notExists":
        return (
          <ExistsExpressionComponent
            value={data as Parameters<typeof ExistsExpressionComponent>[0]["value"]}
            onChange={
              handleDataChange as Parameters<typeof ExistsExpressionComponent>[0]["onChange"]
            }
            disabled={disabled}
            mode={mode}
            presentation={presentation}
          />
        );
      case "empty":
      case "notEmpty":
        return (
          <EmptyExpressionComponent
            value={data as Parameters<typeof EmptyExpressionComponent>[0]["value"]}
            onChange={
              handleDataChange as Parameters<typeof EmptyExpressionComponent>[0]["onChange"]
            }
            disabled={disabled}
            mode={mode}
            presentation={presentation}
          />
        );
      case "equals":
      case "notEquals":
        return (
          <EqualityExpressionComponent
            value={data as Parameters<typeof EqualityExpressionComponent>[0]["value"]}
            onChange={
              handleDataChange as Parameters<typeof EqualityExpressionComponent>[0]["onChange"]
            }
            disabled={disabled}
            mode={mode}
          />
        );
      case "greaterThan":
      case "greaterThanEquals":
      case "lessThan":
      case "lessThanEquals":
        return (
          <NumericExpressionComponent
            value={data as Parameters<typeof NumericExpressionComponent>[0]["value"]}
            onChange={
              handleDataChange as Parameters<typeof NumericExpressionComponent>[0]["onChange"]
            }
            disabled={disabled}
            mode={mode}
          />
        );
      case "between":
        return (
          <BetweenExpressionComponent
            value={data as Parameters<typeof BetweenExpressionComponent>[0]["value"]}
            onChange={
              handleDataChange as Parameters<typeof BetweenExpressionComponent>[0]["onChange"]
            }
            disabled={disabled}
            mode={mode}
          />
        );
      case "startsWith":
      case "endsWith":
      case "matches":
        return (
          <StringExpressionComponent
            value={data as Parameters<typeof StringExpressionComponent>[0]["value"]}
            onChange={
              handleDataChange as Parameters<typeof StringExpressionComponent>[0]["onChange"]
            }
            disabled={disabled}
            mode={mode}
          />
        );
      case "in":
      case "notIn":
        return (
          <CollectionInExpressionComponent
            value={data as Parameters<typeof CollectionInExpressionComponent>[0]["value"]}
            onChange={
              handleDataChange as Parameters<typeof CollectionInExpressionComponent>[0]["onChange"]
            }
            disabled={disabled}
            mode={mode}
          />
        );
      case "containsAny":
      case "containsAll":
        return (
          <CollectionContainsExpressionComponent
            value={data as Parameters<typeof CollectionContainsExpressionComponent>[0]["value"]}
            onChange={
              handleDataChange as Parameters<
                typeof CollectionContainsExpressionComponent
              >[0]["onChange"]
            }
            disabled={disabled}
            mode={mode}
          />
        );
      case "hasBadge":
        return (
          <HasBadgeExpressionComponent
            value={data as Parameters<typeof HasBadgeExpressionComponent>[0]["value"]}
            onChange={
              handleDataChange as Parameters<typeof HasBadgeExpressionComponent>[0]["onChange"]
            }
            disabled={disabled}
            mode={mode}
          />
        );
      case "isMetadataType":
        return (
          <IsMetadataTypeExpressionComponent
            value={data as Parameters<typeof IsMetadataTypeExpressionComponent>[0]["value"]}
            onChange={
              handleDataChange as Parameters<
                typeof IsMetadataTypeExpressionComponent
              >[0]["onChange"]
            }
            disabled={disabled}
            mode={mode}
            presentation={presentation}
          />
        );
      case "inMetadataGroup":
        return (
          <InMetadataGroupExpressionComponent
            value={data as Parameters<typeof InMetadataGroupExpressionComponent>[0]["value"]}
            onChange={
              handleDataChange as Parameters<
                typeof InMetadataGroupExpressionComponent
              >[0]["onChange"]
            }
            disabled={disabled}
            mode={mode}
            presentation={presentation}
          />
        );
      case "isChildMetadata":
        return (
          <IsChildMetadataExpressionComponent
            value={data as Parameters<typeof IsChildMetadataExpressionComponent>[0]["value"]}
            onChange={
              handleDataChange as Parameters<
                typeof IsChildMetadataExpressionComponent
              >[0]["onChange"]
            }
            disabled={disabled}
            mode={mode}
            presentation={presentation}
          />
        );
      case "currentTier":
        return (
          <CurrentTierExpressionComponent
            value={data as Parameters<typeof CurrentTierExpressionComponent>[0]["value"]}
            onChange={
              handleDataChange as Parameters<typeof CurrentTierExpressionComponent>[0]["onChange"]
            }
            disabled={disabled}
            mode={mode}
          />
        );
      case "targetCompleted":
        return (
          <TargetCompletedExpressionComponent
            value={data as Parameters<typeof TargetCompletedExpressionComponent>[0]["value"]}
            onChange={
              handleDataChange as Parameters<
                typeof TargetCompletedExpressionComponent
              >[0]["onChange"]
            }
            disabled={disabled}
            mode={mode}
          />
        );
      case "eventCount":
        return (
          <EventCountExpressionComponent
            value={data as Parameters<typeof EventCountExpressionComponent>[0]["value"]}
            onChange={
              handleDataChange as Parameters<typeof EventCountExpressionComponent>[0]["onChange"]
            }
            disabled={disabled}
            mode={mode}
          />
        );
      case "eventSum":
        return (
          <EventSumExpressionComponent
            value={data as Parameters<typeof EventSumExpressionComponent>[0]["value"]}
            onChange={
              handleDataChange as Parameters<typeof EventSumExpressionComponent>[0]["onChange"]
            }
            disabled={disabled}
            mode={mode}
            presentation={presentation}
          />
        );
      case "eventExists":
        return (
          <EventExistsExpressionComponent
            value={data as Parameters<typeof EventExistsExpressionComponent>[0]["value"]}
            onChange={
              handleDataChange as Parameters<typeof EventExistsExpressionComponent>[0]["onChange"]
            }
            disabled={disabled}
            mode={mode}
          />
        );
      case "lastEventTime":
        return (
          <LastEventTimeExpressionComponent
            value={data as Parameters<typeof LastEventTimeExpressionComponent>[0]["value"]}
            onChange={
              handleDataChange as Parameters<typeof LastEventTimeExpressionComponent>[0]["onChange"]
            }
            disabled={disabled}
            mode={mode}
          />
        );
      case "funnelStage":
        return (
          <FunnelStageExpressionComponent
            value={data as Parameters<typeof FunnelStageExpressionComponent>[0]["value"]}
            onChange={
              handleDataChange as Parameters<typeof FunnelStageExpressionComponent>[0]["onChange"]
            }
            disabled={disabled}
            mode={mode}
          />
        );
      case "hasProgramCurrency":
        return (
          <HasProgramCurrencyExpressionComponent
            value={data as Parameters<typeof HasProgramCurrencyExpressionComponent>[0]["value"]}
            onChange={
              handleDataChange as Parameters<
                typeof HasProgramCurrencyExpressionComponent
              >[0]["onChange"]
            }
            disabled={disabled}
            mode={mode}
          />
        );
      default:
        return <p className="text-muted-foreground text-xs">Unknown expression type: {type}</p>;
    }
  };

  // Sentence-mode rendering (R4/R5/R6/R6a). Comparison-family types (R4/KTD1)
  // get the flowing `ComparisonSentence` template; the ~13 specialized types
  // (KTD6) reuse their current field component from `renderExpressionFields`
  // above, wrapped in this same flat shell rather than the card-mode Card —
  // a compact fallback, not a bespoke sentence template per type (fix #21).
  if (presentation === "sentence") {
    return (
      <div
        className="border-border/60 bg-card flex flex-wrap items-start gap-2 rounded-lg border p-3"
        data-presentation={presentation}
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          {isComparisonFamilyType(type) ? (
            <ComparisonSentence
              type={type}
              data={data}
              onDataChange={handleDataChange}
              onTypeChange={handleTypeChange}
              disabled={disabled}
            />
          ) : (
            <>
              <Badge variant="outline" className="text-[11px]">
                {typeName}
              </Badge>
              {renderExpressionFields()}
            </>
          )}
          {!!showActions && (
            <div className="mt-3">
              <ActionList
                actions={actions ?? EMPTY_ACTIONS}
                onChange={handleActionsChange}
                disabled={disabled}
                presentation={presentation}
              />
            </div>
          )}
        </div>
        {renderConditionAside?.(expression)}
        {!!onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={disabled}
            className="text-destructive hover:text-destructive h-11 w-11 shrink-0 p-0"
            aria-label="Remove expression"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="border-border/60" data-presentation={presentation}>
      <CardHeader className="flex flex-row items-center justify-between px-3 py-2">
        <button
          type="button"
          className="flex items-center gap-2"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="text-muted-foreground h-4 w-4" />
          ) : (
            <ChevronRight className="text-muted-foreground h-4 w-4" />
          )}
          <Badge variant="outline" className="text-[11px]">
            {typeName}
          </Badge>
          {depth > 0 && <span className="text-muted-foreground text-[11px]">depth {depth}</span>}
        </button>
        {!!onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={disabled}
            className="text-destructive hover:text-destructive h-7 w-7 p-0"
            aria-label="Remove expression"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </CardHeader>
      {expanded && (
        <CardContent className="px-3 pt-0 pb-3">
          {renderExpressionFields()}

          {/* Actions section (shown only when showActions is true) */}
          {!!showActions && (
            <div className="mt-4">
              <ActionList
                actions={actions ?? EMPTY_ACTIONS}
                onChange={handleActionsChange}
                disabled={disabled}
                presentation={presentation}
              />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
});
