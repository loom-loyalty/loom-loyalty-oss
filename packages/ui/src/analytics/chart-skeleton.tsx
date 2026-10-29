import type { ReactNode } from "react";
import { Skeleton } from "../primitives/skeleton";

interface ChartSkeletonProps {
  height?: number;
  variant?: "area" | "bar" | "donut" | "kpi";
}

export function ChartSkeleton({ height = 300, variant = "area" }: ChartSkeletonProps): ReactNode {
  if (variant === "kpi") {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading chart data">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
    );
  }

  if (variant === "donut") {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height }}
        aria-busy="true"
        aria-label="Loading chart data"
      >
        <Skeleton className="h-48 w-48 rounded-full" />
      </div>
    );
  }

  const BAR_HEIGHTS = [55, 75, 40, 88, 62, 45, 70, 83, 50, 65, 78, 42];

  return (
    <div className="space-y-2" style={{ height }} aria-busy="true" aria-label="Loading chart data">
      <div className="flex h-full items-end gap-1">
        {BAR_HEIGHTS.map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}
