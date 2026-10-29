import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../lib/utils.js";
import { pathToBreadcrumbs } from "./json-path-input.js";

export interface JsonPathBreadcrumbProps {
  path: string;
  tailOnly?: boolean;
  className?: string;
}

/** Read-only, friendly display of a JSONPath. */
export function JsonPathBreadcrumb({
  path,
  tailOnly = false,
  className,
}: JsonPathBreadcrumbProps): ReactNode {
  const breadcrumbs = pathToBreadcrumbs(path);

  if (!breadcrumbs) {
    return (
      <span className={className} title={path || undefined}>
        {path || "No field selected"}
      </span>
    );
  }

  const visibleBreadcrumbs = tailOnly ? breadcrumbs.slice(-1) : breadcrumbs;

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)} title={path}>
      {visibleBreadcrumbs.map((breadcrumb, index) => (
        <span key={`${breadcrumb.label}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 && <ChevronRight className="text-muted-foreground h-3 w-3 shrink-0" />}
          <span className="bg-muted rounded px-1.5 py-0.5">
            {breadcrumb.label}
            {breadcrumb.isArray && "[]"}
          </span>
        </span>
      ))}
    </span>
  );
}
