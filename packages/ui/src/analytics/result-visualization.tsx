/**
 * Result visualization — Spindle
 *
 * Wraps a SQL result in a view switcher: the rows as a table, or drawn as a
 * bar, pie, or line chart. The view is chosen automatically from the result's
 * shape, and only views that represent the data honestly are offered — see
 * `inferVisualization`.
 *
 * Auto-selection is re-run whenever a new result arrives; an explicit choice
 * holds only for the result it was made against. Carrying a pie selection onto
 * the next query would either misrepresent it or silently fall back, and both
 * read as the control being broken.
 */
import { BarChart3, ChartLine, ChartPie, Info, Table2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { cn } from "../lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../primitives/select";
import { ToggleGroup, ToggleGroupItem } from "../primitives/toggle-group";
import { applyChartShape, toChartShape } from "./chart-shape";
import type { ChartShape } from "./chart-shape-types";
import { inferVisualization, type VizKind, type VizPlan } from "./infer-visualization";
import { QueryResultsTable, type QueryResultsTableProps } from "./query-results-table";
import { ResultChart } from "./result-chart";

const VIEW_META: Record<VizKind, { label: string; icon: typeof Table2 }> = {
  table: { label: "Table", icon: Table2 },
  bar: { label: "Bar", icon: BarChart3 },
  pie: { label: "Pie", icon: ChartPie },
  line: { label: "Line", icon: ChartLine },
};

/** Order the switcher always renders in, independent of the plan's preference. */
const VIEW_ORDER: VizKind[] = ["table", "bar", "pie", "line"];

export interface ResultVisualizationProps extends Omit<QueryResultsTableProps, "columns" | "rows"> {
  columns: Array<{ name: string; type: string }>;
  rows: Array<Record<string, unknown>>;
  /**
   * Identifies the result the current view belongs to — normally the executed
   * SQL. When it changes, auto-selection runs again.
   */
  resultKey?: string;
  /**
   * Controlled chart shape (e.g. from a saved view). When set, the view and
   * measure come from it; a shape that no longer fits the result falls back to
   * the inferred view with an inline note. Omit for uncontrolled behavior.
   */
  shape?: ChartShape;
  /** Called with the new shape whenever the user changes the view or measure. */
  onShapeChange?: (shape: ChartShape) => void;
}

export function ResultVisualization({
  columns,
  rows,
  resultKey,
  shape,
  onShapeChange,
  ...tableProps
}: ResultVisualizationProps): ReactNode {
  const applied = shape ? applyChartShape(shape, columns, rows) : null;
  const plan: VizPlan = applied?.plan ?? inferVisualization(columns, rows);

  // A choice is stored together with the result it was made against, so a new
  // result re-decides simply by no longer matching — no reset effect, and no
  // render where the previous result's view is still showing.
  const [choice, setChoice] = useState<{ key?: string; view?: VizKind; measure?: string } | null>(
    null
  );
  const active = choice?.key === resultKey ? choice : null;

  // A choice is honored only while it remains among the honest views for this
  // data — a stale pie selection falls back rather than rendering nonsense.
  // In controlled mode the shape (already validated) decides instead.
  const view: VizKind = applied
    ? plan.kind
    : active?.view && plan.available.includes(active.view)
      ? active.view
      : plan.kind;
  const activeMeasure = applied
    ? applied.measure
    : active?.measure && plan.measures.includes(active.measure)
      ? active.measure
      : (plan.measures[0] ?? "");

  const emit = (kind: VizKind, measure: string) =>
    onShapeChange?.(
      toChartShape(plan, {
        kind,
        measure: measure || undefined,
        title: shape?.title,
        axisLabelX: shape?.axisLabelX,
        axisLabelY: shape?.axisLabelY,
      })
    );
  const chooseView = (next: VizKind) => {
    if (!applied) setChoice({ ...active, key: resultKey, view: next });
    emit(next, activeMeasure);
  };
  const chooseMeasure = (measure: string) => {
    if (!applied) setChoice({ ...active, key: resultKey, measure });
    emit(view, measure);
  };

  const views = VIEW_ORDER.filter((kind) => plan.available.includes(kind));
  // A single available view means there is nothing to switch between.
  const showSwitcher = views.length > 1;
  // The line chart draws every measure at once, so picking one would do nothing.
  const showMeasurePicker = view !== "table" && view !== "line" && plan.measures.length > 1;

  return (
    <div className="flex flex-col gap-3">
      {applied?.fallbackReason && (
        <p
          role="status"
          className="border-warning/40 bg-warning/10 text-foreground flex items-start gap-2 rounded-md border px-3 py-2 text-xs"
        >
          <Info className="text-warning-dark mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">
            The saved chart no longer matches this result, so an automatic view is shown.{" "}
            {applied.fallbackReason}
          </span>
        </p>
      )}
      {(showSwitcher || showMeasurePicker) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">{plan.reason}</p>
          <div className="flex items-center gap-2">
            {showMeasurePicker && (
              <Select value={activeMeasure} onValueChange={chooseMeasure}>
                <SelectTrigger className="h-9 w-auto min-w-36 text-xs" aria-label="Measure">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {plan.measures.map((name) => (
                    <SelectItem key={name} value={name} className="text-xs">
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {showSwitcher && (
              <ToggleGroup
                type="single"
                value={view}
                onValueChange={(next: string) => {
                  if (next) chooseView(next as VizKind);
                }}
                aria-label="Result view"
              >
                {views.map((kind) => {
                  const { label, icon: Icon } = VIEW_META[kind];
                  return (
                    <ToggleGroupItem
                      key={kind}
                      value={kind}
                      // 44px min touch target, per the accessibility baseline.
                      className="h-11 gap-1.5 px-3 text-xs sm:h-9"
                      aria-label={`Show as ${label.toLowerCase()}`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">{label}</span>
                    </ToggleGroupItem>
                  );
                })}
              </ToggleGroup>
            )}
          </div>
        </div>
      )}

      {view === "table" ? (
        <QueryResultsTable columns={columns} rows={rows} {...tableProps} />
      ) : (
        <div className={cn("border-border bg-card rounded-lg border p-4")}>
          <ResultChart plan={plan} rows={rows} measure={activeMeasure} />
          {/* The chart is role="img"; the rows stay reachable as text for
              anyone who cannot read the marks, without leaving the view. */}
          <details className="mt-3">
            <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
              Show {rows.length === 1 ? "the row" : `all ${String(rows.length)} rows`} as a table
            </summary>
            <div className="pt-3">
              <QueryResultsTable columns={columns} rows={rows} {...tableProps} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
