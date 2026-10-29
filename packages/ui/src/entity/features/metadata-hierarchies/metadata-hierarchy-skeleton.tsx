/**
 * Metadata Hierarchy table loading skeleton (the filter bar stays mounted above it).
 */

import type { ReactNode } from "react";
import { Skeleton } from "../../../primitives/skeleton.js";

export function MetadataHierarchySkeleton(): ReactNode {
  return (
    <div className="space-y-6" role="status" aria-label="Loading metadata hierarchies">
      <div className="border-border overflow-hidden rounded-lg border">
        <div className="bg-muted flex gap-4 p-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-4 w-24" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="border-border flex gap-4 border-t p-4">
            <div className="w-36 space-y-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
