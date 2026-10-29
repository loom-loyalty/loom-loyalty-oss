/**
 * Event Rule Loading Skeleton
 *
 * Skeleton loading state matching the event rules table layout.
 */

import type { ReactNode } from "react";
import { Skeleton } from "../../../primitives/skeleton.js";

export function EventRuleSkeleton(): ReactNode {
  return (
    <div className="space-y-6" role="status" aria-label="Loading event rules">
      {/* Filter bar skeleton */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Skeleton className="h-10 flex-1" />
          <div className="border-border hidden h-8 border-l sm:block" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="border-border overflow-hidden rounded-lg border">
        {/* Table header */}
        <div className="bg-muted p-3">
          <div className="flex gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        {/* Table rows */}
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="border-border flex gap-4 border-t p-4">
            <div className="w-32">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="mt-1 h-3 w-20" />
            </div>
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
        {/* Pagination */}
        <div className="border-border flex items-center justify-between border-t p-3">
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-1">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </div>
    </div>
  );
}
