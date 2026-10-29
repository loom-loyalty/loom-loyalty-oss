/**
 * Data Model Loading Skeleton
 *
 * Shared skeleton loading state for the merged Data Models list page.
 * Matches the 6-column layout (Data Model | Class | Elements | Version | Child Types | Modified).
 */

import type { ReactNode } from "react";
import { Skeleton } from "../../../primitives/skeleton.js";

/**
 * Loading skeleton for the data models list page.
 * Includes classification stats bar + filter + table.
 */
export function DataModelSkeleton(): ReactNode {
  return (
    <div className="space-y-6" role="status" aria-label="Loading data models">
      {/* Classification stats bar skeleton */}
      <div className="border-border bg-muted/30 flex items-center gap-3 rounded-lg border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-4 w-1" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-14" />
        </div>
        <Skeleton className="h-4 w-1" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-14" />
        </div>
      </div>

      {/* Filter bar skeleton */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="border-border overflow-hidden rounded-lg border">
        <div className="bg-muted p-3">
          <div className="flex gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="border-border flex gap-4 border-t p-4">
            <div className="w-32">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="mt-1 h-3 w-20" />
            </div>
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
        <div className="border-border flex items-center justify-between border-t p-3">
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-1">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </div>
    </div>
  );
}
