/**
 * True Expression Component
 *
 * Static display for the "always true" expression. No configurable fields.
 */

import { memo, type ReactNode } from "react";
import { Badge } from "../../primitives/badge.js";

import type { ExpressionComponentProps, TrueExpression } from "../types";

type TrueData = TrueExpression["true"];

export const TrueExpressionComponent = memo(function TrueExpressionComponent({
  className,
}: ExpressionComponentProps<TrueData>): ReactNode {
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Badge
          variant="default"
          className="bg-success/10 text-success-dark border-success/20 border"
        >
          Always True
        </Badge>
        <span className="text-muted-foreground text-xs">
          This expression always evaluates to true. Attach actions below.
        </span>
      </div>
    </div>
  );
});
