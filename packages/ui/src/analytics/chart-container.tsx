import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../primitives/card";
import type { LinkComponentProps } from "../shell/sidebar";
import { ChartEmpty } from "./chart-empty";
import { ChartError } from "./chart-error";
import { ChartExploreLink } from "./chart-explore-link";
import { ChartExportButton } from "./chart-export-button";
import { ChartSkeleton } from "./chart-skeleton";

interface ChartContainerProps {
  title: string;
  children: ReactNode;
  isLoading?: boolean;
  error?: Error | null;
  isEmpty?: boolean;
  onRetry?: () => void;
  onExport?: () => void;
  isExporting?: boolean;
  /**
   * Opens this chart's whole result in the SQL workbench. Omitted by apps that
   * do not ship one, which is what keeps the affordance out of the Dashboard.
   */
  exploreHref?: string;
  /** Optional app-level router adapter for drill-down links. */
  LinkComponent?: React.ComponentType<LinkComponentProps>;
  headerActions?: ReactNode;
  skeletonVariant?: "area" | "bar" | "donut" | "kpi";
  height?: number;
  className?: string;
}

export function ChartContainer({
  title,
  children,
  isLoading,
  error,
  isEmpty,
  onRetry,
  onExport,
  isExporting,
  exploreHref,
  LinkComponent,
  headerActions,
  skeletonVariant = "area",
  height,
  className,
}: ChartContainerProps): ReactNode {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between px-5 py-3 pb-1">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        <div className="flex items-center gap-1">
          {headerActions}
          {exploreHref && (
            <ChartExploreLink href={exploreHref} chartTitle={title} LinkComponent={LinkComponent} />
          )}
          {onExport && <ChartExportButton onClick={onExport} isExporting={isExporting} />}
        </div>
      </CardHeader>
      <CardContent className="px-5 py-3">
        {isLoading ? (
          <ChartSkeleton variant={skeletonVariant} height={height} />
        ) : error ? (
          <ChartError message={error.message} onRetry={onRetry} />
        ) : isEmpty ? (
          <ChartEmpty />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
