import type { KeyboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useId, useMemo, useRef } from "react";

import { cn } from "../lib/utils";
import {
  bandEdges,
  funnelRowHeights,
  funnelWidths,
  MIN_SEGMENT,
  trapezoidPoints,
} from "./funnel-sizing";

/**
 * Structurally compatible with `CustomerFunnelRow` from @loom-loyalty/analytics.
 * Declared inline here to break the analytics → ui → analytics import cycle —
 * the analytics package's page components consume this primitive, so importing
 * the type back from analytics would form a build-time cycle.
 */
export interface LifecycleFunnelRow {
  stage_order: number;
  stage: string;
  customer_count: number;
  pct_of_total: number;
}

interface LifecycleFunnelProps {
  /** Always 9 rows from api_customer_funnel (BE LEFT JOINs to range(1, 10)). */
  data: LifecycleFunnelRow[];
  /** Optional comparison set (previous period) — rendered as dashed ghost outlines. */
  comparisonData?: LifecycleFunnelRow[];
  /** Controlled selection — stage_order (1..9) of the selected stage, or null. */
  selectedStageOrder?: number | null;
  /** Called on click or Enter — toggle behavior (click selected = deselect). */
  onSelectStage?: (stageOrder: number | null) => void;
}

function formatCount(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString();
}

/**
 * Customer lifecycle funnel — 9 stages stacked vertically as centered, gradient
 * trapezoid bands that trace a diamond/double-funnel silhouette: wide Awareness,
 * narrowing to the Advocacy apex, widening through the dormancy tail. Bar WIDTH
 * reflects log(customer_count) with an 8% floor; the shape IS a diagnosis of
 * program health — see docs/designs/customer-funnel-decile.md §Visual Direction.
 *
 * Each stage carries its own bright gradient (`--viz-funnel-{order}-*`) so the
 * full lifecycle reads as a deliberate spectrum — a centerpiece, cool at the top
 * through the gold Advocacy apex into the warm dormancy tail.
 *
 * Interaction:
 *   hover → brightens the band
 *   click → toggle selection (selected stage grows in HEIGHT; others dim)
 *   keyboard → arrow up/down cycles selection within the listbox, Enter selects,
 *              Esc deselects, Home/End jump to first/last
 *   ARIA → role="listbox" on container; role="option" + aria-selected per stage.
 *          Roving tabindex per WAI-ARIA APG: only ONE option is tabbable at a
 *          time — the selected stage if there is one, otherwise the first stage.
 *          Selection changes via keyboard move DOM focus to the new option.
 */
export function LifecycleFunnel({
  data,
  comparisonData,
  selectedStageOrder,
  onSelectStage,
}: LifecycleFunnelProps): ReactNode {
  // Sanitize React's useId() (`:r0:`) so the colons can't leak into SVG `id` /
  // `url(#…)` refs — consistent with ConnectiveThread's defensive sanitization.
  const gradientPrefix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const counts = useMemo(() => data.map((d) => d.customer_count), [data]);
  const maxCount = useMemo(() => Math.max(0, ...counts), [counts]);
  // Keyboard-nav bounds derived from the data (not hardcoded 1–9) so a different
  // stage count can't silently break arrow / Home / End navigation.
  const firstStage = data[0]?.stage_order ?? 1;
  const lastStage = data[data.length - 1]?.stage_order ?? 9;

  // Band widths (data-only): selection grows HEIGHT, not width, so the diamond
  // shape is preserved during interaction.
  const edges = useMemo(() => bandEdges(funnelWidths(counts, maxCount)), [counts, maxCount]);

  const selectedIndex = useMemo(
    () =>
      selectedStageOrder == null
        ? null
        : data.findIndex((d) => d.stage_order === selectedStageOrder),
    [data, selectedStageOrder]
  );
  const hasSelection = selectedIndex !== null && selectedIndex >= 0;

  // Row heights: uniform, with the selected row grown via flex-basis.
  const heights = useMemo(
    () => funnelRowHeights(data.length, hasSelection ? selectedIndex : null),
    [data.length, selectedIndex, hasSelection]
  );

  // Comparison ghost edges — aligned by stage_order, scaled against the CURRENT
  // period's maxCount so both share a denominator. Clamp to <= 1: a comparison
  // stage larger than any current stage would otherwise exceed the track, and the
  // dashed ghost would clip/distort against the SVG viewBox.
  const comparisonEdges = useMemo(() => {
    if (!comparisonData) return null;
    const byStage = new Map(comparisonData.map((d) => [d.stage_order, d.customer_count]));
    const compCounts = data.map((d) => byStage.get(d.stage_order) ?? 0);
    const compWidths = funnelWidths(compCounts, maxCount).map((w) => Math.min(1, w));
    return bandEdges(compWidths);
  }, [data, comparisonData, maxCount]);

  // Which stage holds the single roving-tabindex slot. Follows selection, but only
  // when that stage actually exists in `data` — otherwise no <li> would be tabbable
  // and the listbox would be unreachable by keyboard. Falls back to the first stage.
  const selectionExists =
    selectedStageOrder != null && data.some((d) => d.stage_order === selectedStageOrder);
  const tabbableStageOrder = (selectionExists ? selectedStageOrder : data[0]?.stage_order) ?? null;

  // Per-row refs so keyboard selection can move DOM focus to the newly-selected
  // stage. Without it the screen reader announces the new selection but Tab still
  // sits on the stale row.
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  useEffect(() => {
    if (selectedStageOrder == null) return;
    const idx = data.findIndex((d) => d.stage_order === selectedStageOrder);
    if (idx < 0) return;
    const el = itemRefs.current[idx];
    // Only steal focus if it currently sits on a peer <li> in this listbox — avoid
    // yanking focus from unrelated parts of the page (e.g. the cohort control).
    if (el && el !== document.activeElement) {
      const active = document.activeElement;
      const movedFromPeer = itemRefs.current.some((peer) => peer === active);
      if (movedFromPeer) el.focus();
    }
  }, [selectedStageOrder, data]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLLIElement>, stageOrder: number) => {
      if (!onSelectStage) return;
      if (e.key === "Enter") {
        e.preventDefault();
        onSelectStage(stageOrder === selectedStageOrder ? null : stageOrder);
      } else if (e.key === "Escape") {
        if (selectedStageOrder !== null && selectedStageOrder !== undefined) {
          e.preventDefault();
          onSelectStage(null);
        }
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        // Move from the CURRENT or focused row (not from 0).
        const cur = selectedStageOrder ?? stageOrder;
        onSelectStage(Math.min(lastStage, cur + 1));
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        const cur = selectedStageOrder ?? stageOrder;
        onSelectStage(Math.max(firstStage, cur - 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        onSelectStage(firstStage);
      } else if (e.key === "End") {
        e.preventDefault();
        onSelectStage(lastStage);
      }
    },
    [onSelectStage, selectedStageOrder, firstStage, lastStage]
  );

  return (
    <ul
      role="listbox"
      aria-label="Customer lifecycle funnel"
      className="flex h-[34rem] w-full flex-col sm:h-[40rem]"
    >
      {data.map((row, i) => {
        const isSelected = i === selectedIndex;
        const dimmed = hasSelection && !isSelected;
        const height = heights[i] ?? 1 / data.length;
        const edge = edges[i] ?? { top: MIN_SEGMENT, bottom: MIN_SEGMENT };
        const compEdge = comparisonEdges?.[i];
        // Palette is keyed to stage MEANING (1 Awareness → 6 Advocacy apex → 9
        // Inactive). Clamp to 1..9 so malformed stage_order can't yield a missing
        // token (transparent fill).
        const paletteIndex = Math.min(9, Math.max(1, row.stage_order));
        const gradientId = `${gradientPrefix}-funnel-${paletteIndex}`;
        return (
          <li
            key={row.stage_order}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            role="option"
            aria-selected={isSelected}
            tabIndex={row.stage_order === tabbableStageOrder ? 0 : -1}
            onClick={() => onSelectStage?.(isSelected ? null : row.stage_order)}
            onKeyDown={(e) => handleKeyDown(e, row.stage_order)}
            style={{ flexBasis: `${(height * 100).toFixed(2)}%` }}
            className={cn(
              "group grid min-h-0 cursor-pointer items-stretch gap-2 rounded-md outline-none",
              "grid-cols-[4.5rem_1fr_4rem] sm:grid-cols-[8rem_1fr_6.5rem] sm:gap-4",
              "focus-visible:ring-primary focus-visible:ring-2",
              "motion-safe:transition-all motion-safe:duration-300",
              dimmed ? "opacity-40 hover:opacity-75" : "opacity-100"
            )}
          >
            {/* Left gutter — stage name (body font per DESIGN.md; serif is 20px+ only) */}
            <span
              className={cn(
                "flex items-center justify-end text-right text-sm leading-tight sm:text-base",
                isSelected ? "text-foreground font-semibold" : "text-foreground/90 font-medium"
              )}
            >
              {row.stage}
            </span>

            {/* Center — the gradient funnel band. The SVG is positioned
                absolutely to fill the cell: a percentage height through the
                grid→flex chain isn't "definite", so h-full would otherwise
                collapse and the SVG would fall back to its 1:1 viewBox size. */}
            <div className="relative min-w-0">
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
                className="absolute inset-0 h-full w-full group-hover:brightness-110 motion-safe:transition-[filter] motion-safe:duration-200"
              >
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      style={{ stopColor: `var(--viz-funnel-${paletteIndex}-from)` }}
                    />
                    <stop
                      offset="100%"
                      style={{ stopColor: `var(--viz-funnel-${paletteIndex}-to)` }}
                    />
                  </linearGradient>
                </defs>
                <polygon points={trapezoidPoints(edge)} fill={`url(#${gradientId})`} />
                {compEdge && (
                  <polygon
                    points={trapezoidPoints(compEdge)}
                    fill="none"
                    stroke="var(--foreground)"
                    strokeOpacity={0.35}
                    strokeWidth={1.25}
                    strokeDasharray="3 3"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>
            </div>

            {/* Right gutter — count + share */}
            <span className="flex flex-col items-start justify-center font-mono text-xs leading-tight tabular-nums sm:text-sm">
              <span className="text-foreground">{formatCount(row.customer_count)}</span>
              <span className="text-muted-foreground/80">{row.pct_of_total.toFixed(1)}%</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
