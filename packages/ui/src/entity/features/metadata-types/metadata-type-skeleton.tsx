/**
 * Metadata Type Loading Skeleton
 *
 * Skeleton loading state matching the unified design.
 */

import type { ReactNode } from "react";
import { Skeleton } from "../../../primitives/skeleton.js";

/**
 * Loading skeleton for metadata type list page
 */
export function MetadataTypeSkeleton(): ReactNode {
  return (
    <div className="space-y-6" role="status" aria-label="Loading metadata types">
      {/* Filter bar skeleton */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Skeleton className="h-10 flex-1" />
          <div className="border-border hidden h-8 border-l sm:block" />
          <Skeleton className="h-10 w-44" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="border-border overflow-hidden rounded-lg border">
        <div className="bg-muted p-3">
          <div className="flex gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
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
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-8" />
            <Skeleton className="h-5 w-24" />
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
