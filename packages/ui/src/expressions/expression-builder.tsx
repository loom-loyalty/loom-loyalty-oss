/**
 * Expression Builder
 *
 * The main recursive component for building expression trees.
 * Handles the empty state, leaf expressions, and composite (and/or/not) expressions.
 */

import { Plus, Trash2 } from "lucide-react";
import { memo, useCallback, useMemo, type ReactNode } from "react";
import { cn } from "../lib/utils.js";
import { Badge } from "../primitives/badge.js";
import { Button } from "../primitives/button.js";

import { ActionList } from "./action-list.js";
import {
  ExpressionContextProvider,
  isRootPathMode,
  useExpressionContext,
  type DataModelLike,
  type ExpressionSurfaceMode,
} from "./expression-context.js";
import { ExpressionNode } from "./expression-node.js";
import {
  CompositeMatchToggle,
  ExpressionTypeSelector,
  MatchModeToggle,
} from "./expression-type-selector.js";
import type { Expression, ExpressionAction, ExpressionPresentation } from "./types.js";
import {
  EXPRESSION_TYPE_NAMES,
  countExpressionNodes,
  createDefaultExpression,
  getExpressionActions,
  getExpressionChildren,
  getExpressionData,
  getExpressionType,
  isCompositeExpression,
} from "./utils.js";

// Stable fallback so `actions={... ?? EMPTY_ACTIONS}` doesn't hand ActionList
// a fresh empty-array reference on every render of a node with no configured
// actions, defeating ActionList's own memo() (adversarial review finding).
const EMPTY_ACTIONS: ExpressionAction[] = [];

export interface ExpressionBuilderProps {
  expression: Expression | null;
  onChange: (expression: Expression | null) => void;
  disabled?: boolean;
  depth?: number;
  label?: string;
  helperText?: string;
  showActions?: boolean;
  /** Data model code for schema-aware JSON path browsing. For event rules, pass the event type code. For customer segments, pass "customer". */
  dataModelCode?: string;
  /** @deprecated Use dataModelCode instead */
  eventTypeCode?: string;
  /** Async function to fetch a data model by type code (for schema browsing) */
  fetchDataModel?: (code: string) => Promise<DataModelLike>;
  /**
   * Authoritative surface (operator gating + labels + path defaults), decided by the
   * CONSUMER: event rules/campaign conditions are single-event → "event"; audiences →
   * "customer". Wins over the dataModelCode-derived default, so an event rule whose
   * dataModelCode is customer (e.g. customer.updated) still hides the audience-only ops.
   * `dataModelCode` is only for schema/path resolution, never the surface.
   */
  mode?: ExpressionSurfaceMode;
  /** True while the parent is still resolving the dataModelCode (e.g. via metadata dereference). */
  isResolvingSchema?: boolean;
  /**
   * Leaf/composite rendering style. `card` (default) is unchanged for every
   * existing consumer; only `ExpressionModal` sets `sentence` (R6a).
   */
  presentation?: ExpressionPresentation;
  /** Root-only: slot rendered beside each sentence-mode leaf (see `ExpressionContextValue`). */
  renderConditionAside?: (condition: Expression) => ReactNode;
}

const MAX_DEPTH = 5;
const MAX_NODES = 50;

const COMPOSITE_BORDER_COLORS: Record<string, string> = {
  and: "border-l-primary",
  or: "border-l-accent",
  not: "border-l-destructive",
};

function SentenceRowPrefix({ label }: { label: string }): ReactNode {
  return (
    <span
      data-slot="expression-row-prefix"
      className="text-muted-foreground w-9 shrink-0 pt-2 font-mono text-[11px] tracking-wide uppercase"
    >
      {label}
    </span>
  );
}

export const ExpressionBuilder = memo(function ExpressionBuilder({
  expression,
  onChange,
  disabled,
  depth = 0,
  label,
  helperText,
  showActions,
  dataModelCode,
  eventTypeCode,
  fetchDataModel,
  mode,
  isResolvingSchema,
  presentation = "card",
  renderConditionAside,
}: ExpressionBuilderProps): ReactNode {
  const resolvedCode = dataModelCode ?? eventTypeCode;
  // Explicit consumer `mode` is authoritative; the dataModelCode heuristic is only a
  // fallback default for callers that don't declare a surface.
  const resolvedMode = mode ?? (resolvedCode?.toUpperCase() === "CUSTOMER" ? "customer" : "event");
  const contentProps = {
    expression,
    onChange,
    disabled,
    depth,
    label,
    helperText,
    showActions,
    mode: resolvedMode,
    presentation,
  };

  // Always mount the context provider at the root (depth 0) so the resolved
  // surface (mode) is authoritative at every nested depth — even when no schema
  // code or fetcher is supplied. Nested builders (depth > 0) inherit it and must
  // NOT re-wrap (that would reset the surface to the "event" fallback).
  if (depth === 0) {
    return (
      <ExpressionContextProvider
        dataModelCode={dataModelCode}
        eventTypeCode={eventTypeCode}
        fetchDataModel={fetchDataModel}
        mode={resolvedMode}
        isResolvingSchema={isResolvingSchema}
        renderConditionAside={renderConditionAside}
      >
        <ExpressionBuilderContent {...contentProps} />
      </ExpressionContextProvider>
    );
  }

  return <ExpressionBuilderContent {...contentProps} />;
});

/**
 * Inner content of ExpressionBuilder — memoized component for React reconciliation.
 */
const ExpressionBuilderContent = memo(function ExpressionBuilderContent({
  expression,
  onChange,
  disabled,
  depth = 0,
  label,
  helperText,
  showActions,
  mode: modeProp,
  presentation = "card",
}: Omit<
  ExpressionBuilderProps,
  "dataModelCode" | "eventTypeCode" | "fetchDataModel" | "renderConditionAside"
>): ReactNode {
  // The context mode (set once at depth 0) is authoritative at every depth; the
  // prop is a fallback for standalone rendering with no provider.
  const mode = useExpressionContext().mode ?? modeProp ?? "event";
  const rootPath = isRootPathMode(mode) ? "$." : "$.eventData.";

  // Promotes a single leaf into a real `and`/`or` composite — optionally
  // appending a second child in the same step (used by "+ Add condition"/
  // "+ Add group" below) — "start the expression" framing: All/Any is
  // reachable from the very first condition, not only once a group already
  // exists. Declared unconditionally (rules-of-hooks) even though it's only
  // invoked from the leaf-expression branch below.
  const promoteToComposite = useCallback(
    (matchType: "and" | "or", extraChild?: Expression) => {
      const children = extraChild ? [expression, extraChild] : [expression];
      onChange({ [matchType]: { children } } as unknown as Expression);
    },
    [expression, onChange]
  );

  // Null expression: empty state + a way to add the first condition.
  if (!expression) {
    const isSentenceRoot = presentation === "sentence" && depth === 0;
    return (
      <div className="space-y-2">
        {!!label && <h4 className="text-sm font-medium">{label}</h4>}
        {!!helperText && <p className="text-muted-foreground text-sm">{helperText}</p>}
        {isSentenceRoot && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Match</span>
            <MatchModeToggle
              value="single"
              onSelect={(nextMode) => {
                if (nextMode === "single") return;
                onChange({
                  [nextMode === "all" ? "and" : "or"]: { children: [] },
                } as unknown as Expression);
              }}
              disabled={disabled}
            />
            <span className="text-muted-foreground text-sm">of these conditions</span>
          </div>
        )}
        <div className="border-border rounded-lg border border-dashed p-6 text-center">
          <p className="text-muted-foreground mb-3 text-sm">No conditions yet.</p>
          <ExpressionTypeSelector
            onSelect={(type) => onChange(createDefaultExpression(type, rootPath))}
            disabled={disabled}
            placeholder="Add condition..."
            className="mx-auto max-w-xs"
            surface={mode}
            excludeTypes={isSentenceRoot ? ["and", "or", "not"] : undefined}
          />
        </div>
      </div>
    );
  }

  const type = getExpressionType(expression);

  // Composite expressions (and/or/not) render recursively
  if (isCompositeExpression(expression)) {
    return (
      <CompositeExpressionBuilder
        expression={expression}
        onChange={onChange}
        disabled={disabled}
        depth={depth}
        label={label}
        helperText={helperText}
        showActions={showActions}
        mode={mode}
        type={type}
        presentation={presentation}
      />
    );
  }

  // Leaf expression
  const isSentenceLeaf = presentation === "sentence";
  const isSentenceRootLeaf = isSentenceLeaf && depth === 0;

  return (
    <div className="space-y-2">
      {!!label && <h4 className="text-sm font-medium">{label}</h4>}
      {!!helperText && <p className="text-muted-foreground text-sm">{helperText}</p>}
      <div className="relative">
        {depth === 0 && !isSentenceLeaf && (
          <div className="mb-2 flex items-center justify-between">
            <ExpressionTypeSelector
              value={type}
              onSelect={(newType) => onChange(createDefaultExpression(newType, rootPath))}
              disabled={disabled}
              className="max-w-xs text-xs"
              surface={mode}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
              disabled={disabled}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        )}
        {isSentenceRootLeaf && (
          <div className="mb-2 flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Match</span>
            <MatchModeToggle
              value="single"
              onSelect={(nextMode) => {
                if (nextMode === "single") return;
                promoteToComposite(nextMode === "all" ? "and" : "or");
              }}
              disabled={disabled}
            />
            <span className="text-muted-foreground text-sm">of these conditions</span>
          </div>
        )}
        <div
          className={cn(
            isSentenceLeaf && "flex items-start gap-2",
            isSentenceRootLeaf && "border-border border-t pt-3"
          )}
        >
          {isSentenceLeaf && <SentenceRowPrefix label={depth === 0 ? "WHEN" : "IF"} />}
          <div className={cn(isSentenceLeaf && "min-w-0 flex-1")}>
            <ExpressionNode
              expression={expression}
              onChange={onChange}
              depth={depth}
              disabled={disabled}
              showActions={showActions}
              presentation={presentation}
              // Sentence mode has no separate root type-selector row (a single,
              // clean condition row per the design reference) — the leaf's own
              // remove control does double duty as "clear the root condition."
              // Card mode is unchanged: the Clear button above still owns this.
              onRemove={depth === 0 && isSentenceLeaf ? () => onChange(null) : undefined}
            />
          </div>
        </div>
        {depth === 0 && <DepthAndNodeWarnings expression={expression} />}
      </div>
    </div>
  );
});

// -- Composite Expression Builder --

interface CompositeExpressionBuilderProps extends ExpressionBuilderProps {
  expression: Expression;
  type: string;
}

const CompositeExpressionBuilder = memo(function CompositeExpressionBuilder({
  expression,
  onChange,
  disabled,
  depth = 0,
  label,
  helperText,
  showActions,
  mode: modeProp,
  type,
  presentation = "card",
}: CompositeExpressionBuilderProps): ReactNode {
  // Context mode is authoritative at every depth; nested composites receive no
  // `mode` prop, so reading it from context is what fixes surface + rootPath.
  const mode = useExpressionContext().mode ?? modeProp ?? "event";
  const rootPath = isRootPathMode(mode) ? "$." : "$.eventData.";
  const data = getExpressionData(expression);
  const children = useMemo(
    () => (getExpressionChildren(expression) ?? []) as Expression[],
    [expression]
  );
  const borderColor = COMPOSITE_BORDER_COLORS[type] ?? "border-l-muted";

  const handleChildChange = useCallback(
    (index: number, child: Expression | null) => {
      if (child === null) {
        // Remove child
        const newChildren = children.filter((_, i) => i !== index);
        onChange({
          [type]: { ...data, children: newChildren },
        } as unknown as Expression);
      } else {
        const newChildren = [...children];
        newChildren[index] = child;
        onChange({
          [type]: { ...data, children: newChildren },
        } as unknown as Expression);
      }
    },
    [type, data, children, onChange]
  );

  const handleAddChild = useCallback(
    (childType: string) => {
      const newChild = createDefaultExpression(childType, rootPath);
      onChange({
        [type]: { ...data, children: [...children, newChild] },
      } as unknown as Expression);
    },
    [type, data, children, onChange, rootPath]
  );

  const handleTypeChange = useCallback(
    (newType: string) => {
      if (["and", "or", "not"].includes(newType)) {
        // Switch between composite types, keep children
        onChange({
          [newType]: { ...data, children },
        } as unknown as Expression);
      } else {
        // Switch to leaf type, discard children
        onChange(createDefaultExpression(newType, rootPath));
      }
    },
    [data, children, onChange, rootPath]
  );

  // Root-only (depth 0, sentence mode, and/or): the "Match One/All/Any of
  // these conditions" sentence must stay the SAME control across the
  // leaf<->composite boundary, not swap to a 2-state All/Any toggle the
  // moment a second condition is promoted in — that swap made "One" visibly
  // vanish (reported UX bug). Selecting "One" while exactly one child remains
  // collapses the composite back to that bare child; it's disabled otherwise
  // (nothing sensible to collapse 0 or 2+ children into).
  const handleRootMatchModeSelect = useCallback(
    (nextMode: "single" | "all" | "any") => {
      if (nextMode === "single") {
        if (children.length === 1) {
          const child = children[0]!;
          // Carry the group's own actions onto the promoted child rather
          // than silently dropping them (Codex review F1) — mirrors the
          // existing actions-preservation pattern in ExpressionNode's own
          // type-switch handler.
          const groupActions = getExpressionActions(expression);
          if (groupActions && groupActions.length > 0) {
            const childType = getExpressionType(child);
            const childData = getExpressionData(child);
            // Merge, don't overwrite (Codex review, second pass) — a child
            // that already carries its own actions (e.g. under the WHAT
            // step's showActions) must keep them alongside the group's,
            // not lose them to the group's list.
            const childActions = getExpressionActions(child) ?? [];
            onChange({
              [childType]: { ...childData, actions: [...childActions, ...groupActions] },
            } as unknown as Expression);
          } else {
            onChange(child);
          }
        }
        return;
      }
      onChange({
        [nextMode === "all" ? "and" : "or"]: { ...data, children },
      } as unknown as Expression);
    },
    [children, data, expression, onChange]
  );

  const canAddChild = depth < MAX_DEPTH;
  const isSentence = presentation === "sentence";
  // `not` is a first-class negation, not a match-count concept (KTD12): its
  // sentence-mode header never renders a control that could switch it to
  // and/or, so the "no conversion" invariant holds structurally.
  const isNot = type === "not";
  // Root-level sentence conditions stay flat (no box, no colored rail) — that
  // treatment is reserved for an explicitly-created NESTED group, matching
  // the design reference where only bracketed sub-groups get a recessed
  // panel. Card mode keeps its existing boxed treatment at every depth.
  const isFlatSentenceRoot = isSentence && depth === 0;
  const sentenceContainerClass = !isSentence
    ? "rounded-lg border-l-4 pl-4"
    : depth > 0
      ? "rounded-xl border border-border border-l-[3px] bg-muted/30 p-3.5"
      : "";

  return (
    <div className="space-y-2">
      {!!label && <h4 className="text-sm font-medium">{label}</h4>}
      {!!helperText && <p className="text-muted-foreground text-sm">{helperText}</p>}
      <div
        data-slot="expression-group"
        className={cn(sentenceContainerClass, !isFlatSentenceRoot && borderColor)}
      >
        {/* Header */}
        <div className="mb-3 flex items-center gap-2">
          {isFlatSentenceRoot && !isNot ? (
            <>
              <span className="text-muted-foreground text-sm">Match</span>
              <MatchModeToggle
                value={type === "or" ? "any" : "all"}
                onSelect={handleRootMatchModeSelect}
                singleDisabled={children.length !== 1}
                disabled={disabled}
              />
              <span className="text-muted-foreground text-sm">of these conditions</span>
            </>
          ) : isSentence ? (
            isNot ? (
              <span className="text-foreground text-xs font-semibold tracking-wide uppercase">
                Does NOT match
              </span>
            ) : (
              <CompositeMatchToggle
                value={type === "or" ? "or" : "and"}
                onSelect={handleTypeChange}
                disabled={disabled}
              />
            )
          ) : depth === 0 ? (
            <ExpressionTypeSelector
              value={type}
              onSelect={handleTypeChange}
              disabled={disabled}
              className="max-w-xs text-xs"
              surface={mode}
            />
          ) : (
            <Badge variant="outline" className="text-xs font-semibold">
              {EXPRESSION_TYPE_NAMES[type] ?? type}
            </Badge>
          )}
          {!isFlatSentenceRoot && (
            <span className="text-muted-foreground text-xs">
              {children.length} child{children.length !== 1 ? "ren" : ""}
            </span>
          )}
          {depth === 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
              disabled={disabled}
              className="text-destructive hover:text-destructive ml-auto"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>

        {/* Children */}
        <div className="space-y-3">
          {children.map((child, index) => {
            const prefix =
              index === 0 ? (depth === 0 ? "WHEN" : "IF") : type === "and" ? "AND" : "OR";
            const rowPrefix = isSentence && !isNot ? <SentenceRowPrefix label={prefix} /> : null;
            // Design reference: every top-level (depth 0) row carries a top
            // divider, including the first — it separates the Match sentence
            // from WHEN. A nested group's rows only pick up the divider from
            // the second row on (its first row sits directly under the
            // group's own Match All/Any header, no divider needed there).
            const rowDivider = isSentence && !isNot && (depth === 0 || index > 0);
            if (isCompositeExpression(child)) {
              return (
                <div
                  key={`${getExpressionType(child)}-${index}`}
                  className={cn(
                    "relative",
                    rowPrefix && "flex items-start gap-2",
                    rowDivider && "border-border border-t pt-3"
                  )}
                >
                  {rowPrefix}
                  <div className={cn(rowPrefix && "min-w-0 flex-1")}>
                    <div className="mb-1 flex items-center justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleChildChange(index, null)}
                        disabled={disabled}
                        className="text-destructive hover:text-destructive h-6 px-2 text-[11px]"
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Remove
                      </Button>
                    </div>
                    <ExpressionBuilder
                      expression={child}
                      onChange={(newChild) => handleChildChange(index, newChild)}
                      disabled={disabled}
                      depth={depth + 1}
                      showActions={showActions}
                      presentation={presentation}
                    />
                  </div>
                </div>
              );
            }
            return (
              <div
                key={`${getExpressionType(child)}-${index}`}
                className={cn(
                  rowPrefix && "flex items-start gap-2",
                  rowDivider && "border-border border-t pt-3"
                )}
              >
                {rowPrefix}
                <div className={cn(rowPrefix && "min-w-0 flex-1")}>
                  <ExpressionNode
                    expression={child}
                    onChange={(newChild) => handleChildChange(index, newChild)}
                    depth={depth + 1}
                    disabled={disabled}
                    onRemove={() => handleChildChange(index, null)}
                    showActions={showActions}
                    presentation={presentation}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Add Child */}
        {canAddChild ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ExpressionTypeSelector
              onSelect={handleAddChild}
              disabled={disabled}
              placeholder={isSentence ? "Add condition..." : "Add child expression..."}
              className="text-xs"
              surface={mode}
              excludeTypes={isSentence ? ["and", "or", "not"] : undefined}
            />
            {isSentence && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddChild("and")}
                disabled={disabled}
                className="bg-card min-h-11 text-xs"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add group
              </Button>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground mt-3 text-xs">
            Maximum nesting depth ({MAX_DEPTH}) reached.
          </p>
        )}

        {/* Actions at composite level */}
        {!!showActions && (
          <div className="mt-4">
            <ActionList
              actions={(data.actions as ExpressionAction[]) ?? EMPTY_ACTIONS}
              onChange={(newActions) => {
                onChange({
                  [type]: { ...data, actions: newActions.length > 0 ? newActions : undefined },
                } as unknown as Expression);
              }}
              disabled={disabled}
              presentation={presentation}
            />
          </div>
        )}
      </div>

      {depth === 0 && <DepthAndNodeWarnings expression={expression} />}
    </div>
  );
});

// -- Warnings --

function DepthAndNodeWarnings({ expression }: { expression: Expression }): ReactNode {
  const nodeCount = countExpressionNodes(expression);
  if (nodeCount > MAX_NODES) {
    return (
      <div className="border-accent/30 bg-accent/5 mt-3 rounded-lg border p-3" role="alert">
        <p className="text-accent-dark text-xs">
          This expression tree has {nodeCount} nodes. Large trees may impact performance. Consider
          simplifying.
        </p>
      </div>
    );
  }
  return null;
}
