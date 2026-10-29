/**
 * Inline notice for persisted expressions whose nodes couldn't be auto-migrated
 * to the corrected DSL and need operator re-entry — bounds dropped on save, a
 * removed operator, or a coupon code stored as a boolean. Renders nothing when
 * the tree is clean (or new-shaped). Inline `role="alert"`, no toast, per the
 * design system.
 */

import { memo, useMemo, type ReactNode } from "react";

import { cn } from "../lib/utils";
import { detectCorruptedNodes } from "./migrate.js";

export interface ExpressionMigrationNoticeProps {
  /**
   * The RAW persisted expression to inspect. Detection must run on the raw tree
   * (not the normalized one), since `normalizeExpression` deletes some corrupt
   * fields before they can be surfaced.
   */
  expression: unknown;
  className?: string;
}

export const ExpressionMigrationNotice = memo(function ExpressionMigrationNotice({
  expression,
  className,
}: ExpressionMigrationNoticeProps): ReactNode {
  const issues = useMemo(() => (expression ? detectCorruptedNodes(expression) : []), [expression]);
  if (issues.length === 0) return null;

  return (
    <div
      className={cn("border-destructive/30 bg-destructive/5 rounded-lg border p-3", className)}
      role="alert"
    >
      <p className="text-destructive text-sm font-medium">
        {issues.length === 1
          ? "One value needs to be re-entered"
          : `${issues.length} values need to be re-entered`}
      </p>
      <p className="text-muted-foreground mt-0.5 text-xs">
        This rule was saved in an older format; the items below couldn&rsquo;t be migrated
        automatically.
      </p>
      <ul className="text-destructive mt-2 list-disc space-y-1 pl-5 text-xs">
        {issues.map((issue, i) => (
          <li key={`${issue.path}-${i}`}>{issue.reason}</li>
        ))}
      </ul>
    </div>
  );
});
