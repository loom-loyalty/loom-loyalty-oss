/**
 * Expression Validation Display
 *
 * Runs validateExpressionTree() and displays errors/warnings inline.
 */

import { type ReactNode } from "react";

import type { Expression } from "./types";
import { validateExpressionTree } from "./utils";

export interface ExpressionValidationProps {
  expression: Expression | null;
  className?: string;
}

export function ExpressionValidation({
  expression,
  className,
}: ExpressionValidationProps): ReactNode {
  if (!expression) return null;

  const errors = validateExpressionTree(expression);
  if (errors.length === 0) return null;

  const errorItems = errors.filter((e) => e.severity === "error");
  const warningItems = errors.filter((e) => e.severity === "warning");

  return (
    <div className={className}>
      {errorItems.length > 0 && (
        <div className="border-destructive/30 bg-destructive/5 rounded-lg border p-3" role="alert">
          <h5 className="text-destructive mb-1 text-xs font-medium">
            Errors ({errorItems.length})
          </h5>
          <ul className="text-destructive list-inside list-disc space-y-0.5 text-xs">
            {errorItems.map((error, i) => (
              <li key={i}>{error.message}</li>
            ))}
          </ul>
        </div>
      )}
      {warningItems.length > 0 && (
        <div className="border-accent/30 bg-accent/5 mt-2 rounded-lg border p-3">
          <h5 className="text-accent-dark mb-1 text-xs font-medium">
            Warnings ({warningItems.length})
          </h5>
          <ul className="text-accent-dark list-inside list-disc space-y-0.5 text-xs">
            {warningItems.map((warning, i) => (
              <li key={i}>{warning.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
