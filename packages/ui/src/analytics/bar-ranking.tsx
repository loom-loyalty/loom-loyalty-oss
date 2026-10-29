import type { ReactNode } from "react";
import type { LinkComponentProps } from "../shell/sidebar";
import { ChartContainer } from "./chart-container";

export interface BarRankingItem {
  label: string;
  value: number;
  subtitle?: string;
  /**
   * Stable code behind the label, used when drilling into this row. Charts show
   * names but queries filter on codes, so the two are carried separately.
   * Falls back to `label` when a chart has no separate code.
   */
  code?: string;
}

interface BarRankingProps {
  title: string;
  data: BarRankingItem[];
  formatValue?: (value: number) => string;
  maxItems?: number;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onExport?: () => void;
  isExporting?: boolean;
  exploreHref?: string;
  /** Optional app-level router adapter for drill-down links. */
  LinkComponent?: React.ComponentType<LinkComponentProps>;
  onItemClick?: (item: BarRankingItem) => void;
  /**
   * Drills into one row. Takes precedence over `onItemClick` and renders the row
   * as a link, so the row navigates with the affordances a link carries
   * (middle-click, open-in-new-tab) rather than emulating them. Returning
   * `undefined` leaves that row non-interactive, which is how a chart with no
   * item-level drill-down still renders.
   */
  getItemHref?: (item: BarRankingItem) => string | undefined;
  className?: string;
}

export function BarRanking({
  title,
  data,
  formatValue = (v) => String(v),
  maxItems = 10,
  isLoading,
  error,
  onRetry,
  onExport,
  isExporting,
  exploreHref,
  LinkComponent = "a" as unknown as React.ComponentType<LinkComponentProps>,
  onItemClick,
  getItemHref,
  className,
}: BarRankingProps): ReactNode {
  const items = data.slice(0, maxItems);
  const maxValue = Math.max(...items.map((d) => d.value), 1);

  return (
    <ChartContainer
      title={title}
      isLoading={isLoading}
      error={error}
      isEmpty={items.length === 0}
      onRetry={onRetry}
      onExport={onExport}
      isExporting={isExporting}
      exploreHref={exploreHref}
      LinkComponent={LinkComponent}
      skeletonVariant="bar"
      className={className}
    >
      <ul className="space-y-3" aria-label={title}>
        {items.map((item) => {
          const content = (
            <>
              <div className="mb-1 flex items-center justify-between">
                <div className="min-w-0">
                  <span className="text-foreground block truncate text-sm font-medium">
                    {item.label}
                  </span>
                  {item.subtitle && (
                    <span className="text-muted-foreground text-xs">{item.subtitle}</span>
                  )}
                </div>
                <span className="text-foreground ml-3 shrink-0 text-sm font-medium">
                  {formatValue(item.value)}
                </span>
              </div>
              <div className="bg-muted h-2 w-full rounded-full">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${(item.value / maxValue) * 100}%` }}
                />
              </div>
            </>
          );

          // The interactive element is nested inside the <li> rather than
          // carrying role="listitem" itself: putting that role on a button or
          // link replaces its own role, and the control stops being announced
          // as something you can activate.
          const interactiveClass =
            "hover:bg-muted/50 focus-visible:ring-ring block w-full cursor-pointer rounded-md px-2 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none";

          const href = getItemHref?.(item);

          return (
            <li key={item.label} className="-mx-2">
              {href ? (
                <LinkComponent
                  href={href}
                  className={interactiveClass}
                  aria-label={`${item.label}: ${formatValue(item.value)} — explore in Spindle`}
                >
                  {content}
                </LinkComponent>
              ) : onItemClick ? (
                <button
                  type="button"
                  className={interactiveClass}
                  onClick={() => onItemClick(item)}
                  aria-label={`${item.label}: ${formatValue(item.value)}`}
                >
                  {content}
                </button>
              ) : (
                <div className="w-full px-2 py-2 text-left">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </ChartContainer>
  );
}
