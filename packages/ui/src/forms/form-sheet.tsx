/**
 * FormSheet - Reusable sheet component for create/edit forms
 *
 * Provides consistent styling and behavior for form-based sheets:
 * - Header with title, optional description, and close button
 * - Scrollable body for form content
 * - Footer with cancel and submit buttons
 * - Built-in loading state support
 * - Server field errors under their fields, with unmatched ones in the footer
 * - Submit disabled, with the reason shown, while the app is read-only (`ReadOnlyProvider`)
 */

import { Loader2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { ErrorReference } from "../data-display/error-state";
import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../primitives/sheet";
import { useReadOnly } from "../shell/read-only";
import { FieldErrorsProvider, type FormFieldError } from "./field-errors";

/** A form-level error: plain text, or a described error carrying a support reference. */
export type FormSheetError = string | { message: string; requestId?: string };

const NO_FIELD_ERRORS: readonly FormFieldError[] = [];
const NO_FIELDS: ReadonlySet<string> = new Set();

/** Identifies a set of field errors by content, so a re-created array is not a new failure. */
function fieldErrorsKey(errors: readonly FormFieldError[]): string {
  return errors.map((e) => `${e.field}\u0000${e.message}`).join("\u0001");
}

export interface FormSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Sheet title */
  title: string;
  /** Optional description below the title */
  description?: string;
  /** Form submit handler */
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  /** Cancel button handler */
  onCancel: () => void;
  /** Whether the form is currently submitting */
  isSubmitting?: boolean;
  /** Disable submit (e.g. when client-side validation hasn't passed) */
  submitDisabled?: boolean;
  /** Submit button label (default: "Save") */
  submitLabel?: string;
  /** Cancel button label (default: "Cancel") */
  cancelLabel?: string;
  /** Form content */
  children: ReactNode;
  /** Which side the sheet appears from (default: "right") */
  side?: "left" | "right";
  /** Additional className for SheetContent */
  className?: string;
  /** Error to display above buttons; a `describeError` result also shows its support reference */
  error?: FormSheetError | null;
  /**
   * Server field errors (e.g. `describeError(err).fieldErrors`). Fields read their own with
   * `useFieldError`; errors whose field is not rendered show above the buttons.
   */
  fieldErrors?: readonly FormFieldError[];
  /** Hide the close button in the header */
  hideCloseButton?: boolean;
}

/**
 * A reusable sheet component for create/edit form patterns.
 *
 * @example
 * ```tsx
 * <FormSheet
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="Create Program"
 *   description="Add a new loyalty program"
 *   onSubmit={handleSubmit}
 *   onCancel={() => setIsOpen(false)}
 *   isSubmitting={mutation.isPending}
 * >
 *   <FormField label="Name" ... />
 *   <FormField label="Code" ... />
 * </FormSheet>
 * ```
 */
export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitDisabled = false,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  children,
  side = "right",
  className,
  error,
  fieldErrors = NO_FIELD_ERRORS,
  hideCloseButton = false,
}: FormSheetProps): ReactNode {
  const formRef = useRef<HTMLFormElement>(null);
  const { readOnly, reason: readOnlyReason } = useReadOnly();
  const blocked = submitDisabled || readOnly;
  const readOnlyNoteId = useId();
  const [registered, setRegistered] = useState<ReadonlySet<string>>(NO_FIELDS);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(NO_FIELDS);
  const errorsKey = fieldErrorsKey(fieldErrors);
  const [errorsShown, setErrorsShown] = useState(errorsKey);

  // A new set of server errors replaces the ones the user already started fixing.
  // Compared by content: callers often pass `describeError(err).fieldErrors`
  // inline, which is a new array on every render.
  if (errorsShown !== errorsKey) {
    setErrorsShown(errorsKey);
    setDismissed(NO_FIELDS);
  }

  // Each finished submit counts as a new failure, so the same server errors
  // coming back again are shown and focused again.
  const [wasSubmitting, setWasSubmitting] = useState(isSubmitting);
  const [settledSubmits, setSettledSubmits] = useState(0);
  if (wasSubmitting !== isSubmitting) {
    setWasSubmitting(isSubmitting);
    if (!isSubmitting) {
      setSettledSubmits((n) => n + 1);
      setDismissed(NO_FIELDS);
    }
  }

  // Move focus to the first invalid field after a failed submit.
  useEffect(() => {
    if (errorsKey === "") return;
    const frame = requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [errorsKey, settledSubmits]);

  const dismissFieldError = useCallback((field: string) => {
    setDismissed((prev) => (prev.has(field) ? prev : new Set(prev).add(field)));
  }, []);

  // Editing a native control clears its server error; custom widgets call
  // `dismiss` from `useFieldError` instead.
  const handleFieldEdit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      const target = e.target as HTMLElement;
      const field =
        target.closest<HTMLElement>("[data-field]")?.dataset.field ??
        target.getAttribute("name") ??
        undefined;
      if (field) dismissFieldError(field);
    },
    [dismissFieldError]
  );

  const unmatchedFieldErrors = fieldErrors.filter(
    (e) => !registered.has(e.field) && !dismissed.has(e.field)
  );
  const errorMessage = typeof error === "string" ? error : error?.message;
  const requestId = typeof error === "object" && error !== null ? error.requestId : undefined;
  // Wrap onSubmit to prevent event bubbling when FormSheet is nested inside another form.
  // Also gate on isSubmitting/submitDisabled so Enter keypress matches the button's click behavior —
  // otherwise browsers can implicit-submit around the disabled button.
  const handleFormSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.stopPropagation();
      if (isSubmitting || blocked) {
        e.preventDefault();
        return;
      }
      onSubmit(e);
    },
    [onSubmit, isSubmitting, blocked]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className={className} hideCloseButton={hideCloseButton}>
        <form
          ref={formRef}
          onSubmit={handleFormSubmit}
          onChange={handleFieldEdit}
          className="flex h-full flex-col"
        >
          <SheetHeader hideCloseButton={hideCloseButton}>
            <SheetTitle>{title}</SheetTitle>
            {description ? (
              <SheetDescription>{description}</SheetDescription>
            ) : (
              <SheetDescription className="sr-only">{title} form</SheetDescription>
            )}
          </SheetHeader>

          <SheetBody>
            <FieldErrorsProvider
              errors={fieldErrors}
              dismissed={dismissed}
              onDismiss={dismissFieldError}
              onRegisteredChange={setRegistered}
            >
              {children}
            </FieldErrorsProvider>
          </SheetBody>

          <SheetFooter>
            {(errorMessage || unmatchedFieldErrors.length > 0 || readOnly) && (
              <div className="mr-auto space-y-1 text-sm">
                {(errorMessage || unmatchedFieldErrors.length > 0) && (
                  <div className="text-destructive" role="alert" aria-live="polite">
                    {errorMessage && <p>{errorMessage}</p>}
                    {unmatchedFieldErrors.map((e) => (
                      <p key={e.field}>{e.message}</p>
                    ))}
                    {requestId && <ErrorReference requestId={requestId} />}
                  </div>
                )}
                {readOnly && (
                  <p id={readOnlyNoteId} className="text-muted-foreground">
                    {readOnlyReason}
                  </p>
                )}
              </div>
            )}
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              {cancelLabel}
            </Button>
            <Button
              type="submit"
              variant="primary-gradient"
              disabled={isSubmitting || blocked}
              aria-describedby={readOnly ? readOnlyNoteId : undefined}
              className={cn((isSubmitting || blocked) && "cursor-not-allowed")}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitLabel}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
