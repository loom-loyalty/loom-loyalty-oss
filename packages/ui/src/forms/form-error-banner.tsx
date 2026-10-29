/**
 * FormErrorBanner - the form-level error for surfaces that are not a FormSheet
 *
 * Shows the message, any server field errors the surface has no field for,
 * and the support reference with a copy button.
 */

import type { ReactNode } from "react";

import { ErrorReference } from "../data-display/error-state";
import { cn } from "../lib/utils";
import type { FormFieldError } from "./field-errors";
import type { FormSheetError } from "./form-sheet";

export interface FormErrorBannerProps {
  /** Plain text, or a `describeError` result whose reference is shown. */
  error?: FormSheetError | null;
  /** Field errors to list; pass only those no rendered field shows. */
  fieldErrors?: readonly FormFieldError[];
  className?: string;
}

export function FormErrorBanner({
  error,
  fieldErrors = [],
  className,
}: FormErrorBannerProps): ReactNode {
  const message = typeof error === "string" ? error : error?.message;
  const requestId = typeof error === "object" && error !== null ? error.requestId : undefined;
  if (!message && fieldErrors.length === 0) return null;
  return (
    <div className={cn("text-destructive text-sm", className)} role="alert">
      {message && <p>{message}</p>}
      {fieldErrors.map((e) => (
        <p key={`${e.field}:${e.message}`}>{e.message}</p>
      ))}
      {requestId && <ErrorReference requestId={requestId} />}
    </div>
  );
}
