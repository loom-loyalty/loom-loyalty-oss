import { Database } from "lucide-react";
import type { ReactNode } from "react";

import { JsonPathBreadcrumb } from "../inputs/json-path-breadcrumb.js";

export interface SchemaValueChipProps {
  path: string;
  /** Schema-resolved field name. Falls back to the path's humanized tail when absent. */
  label?: string;
}

/** A compact indicator that a summary value comes from the event schema. */
export function SchemaValueChip({ path, label }: SchemaValueChipProps): ReactNode {
  return (
    <span
      className="text-primary-dark inline-flex items-center gap-1 rounded-md border border-[var(--raw-teal-100)] bg-[var(--raw-teal-50)] px-1.5 py-0.5 text-xs font-medium"
      title={path}
    >
      <Database className="h-3 w-3 shrink-0" aria-hidden="true" />
      {label ? (
        <span className="min-w-0 truncate">{label}</span>
      ) : (
        <JsonPathBreadcrumb path={path} tailOnly className="min-w-0 truncate" />
      )}
    </span>
  );
}
