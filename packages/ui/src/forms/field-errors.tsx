"use client";

/**
 * Server field errors for forms.
 *
 * `FormSheet` takes the API's `fieldErrors` and provides them through
 * `FieldErrorsProvider`. A field reads its own error by dotted path
 * (`address.postcode`) with `useFieldError`, which also registers the field
 * so errors with no rendered field can fall back to the form's banner.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "../lib/utils";

export interface FormFieldError {
  /** Dotted JSON path of the field, e.g. `address.postcode`. */
  field: string;
  message: string;
}

interface FieldErrorsContextValue {
  errorFor: (field: string) => string | undefined;
  register: (field: string) => () => void;
  dismiss: (field: string) => void;
}

const FieldErrorsContext = createContext<FieldErrorsContextValue | null>(null);

export interface FieldErrorsProviderProps {
  errors: readonly FormFieldError[];
  /** Fields whose error the user already started fixing. */
  dismissed: ReadonlySet<string>;
  /** Marks a field's error as being fixed. */
  onDismiss: (field: string) => void;
  /** Reports the fields that rendered an error slot, so the rest can go to a banner. */
  onRegisteredChange: (fields: ReadonlySet<string>) => void;
  children: ReactNode;
}

export function FieldErrorsProvider({
  errors,
  dismissed,
  onDismiss,
  onRegisteredChange,
  children,
}: FieldErrorsProviderProps): ReactNode {
  const [registered, setRegistered] = useState<Map<string, number>>(() => new Map());

  const register = useCallback((field: string) => {
    setRegistered((prev) => new Map(prev).set(field, (prev.get(field) ?? 0) + 1));
    return () => {
      setRegistered((prev) => {
        const next = new Map(prev);
        const count = (next.get(field) ?? 1) - 1;
        if (count <= 0) next.delete(field);
        else next.set(field, count);
        return next;
      });
    };
  }, []);

  useEffect(() => {
    onRegisteredChange(new Set(registered.keys()));
  }, [registered, onRegisteredChange]);

  const value = useMemo<FieldErrorsContextValue>(
    () => ({
      errorFor: (field) =>
        dismissed.has(field) ? undefined : errors.find((e) => e.field === field)?.message,
      register,
      dismiss: onDismiss,
    }),
    [errors, dismissed, register, onDismiss]
  );

  return <FieldErrorsContext.Provider value={value}>{children}</FieldErrorsContext.Provider>;
}

export interface FieldErrorState {
  error: string | undefined;
  /** Id of the rendered message, for `aria-describedby`. */
  errorId: string;
  /**
   * Clears this field's error. Native inputs clear on change automatically;
   * call this from custom widgets (pickers, comboboxes) when their value changes.
   */
  dismiss: () => void;
  /** Spread onto the control: `aria-invalid`, `aria-describedby` and `data-field`. */
  inputProps: {
    "aria-invalid": true | undefined;
    "aria-describedby": string | undefined;
    "data-field": string;
  };
}

/** Reads the server error for one field and wires its ARIA attributes. */
export function useFieldError(field: string): FieldErrorState {
  const context = useContext(FieldErrorsContext);
  const errorId = `${useId()}-error`;
  const register = context?.register;
  const dismissField = context?.dismiss;

  useEffect(() => register?.(field), [register, field]);
  const dismiss = useCallback(() => dismissField?.(field), [dismissField, field]);

  const error = context?.errorFor(field);
  return {
    error,
    errorId,
    dismiss,
    inputProps: {
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? errorId : undefined,
      "data-field": field,
    },
  };
}

export interface FieldErrorMessageProps {
  id: string;
  error: string | undefined;
  className?: string;
}

/** The message under a control; renders nothing without an error. */
export function FieldErrorMessage({ id, error, className }: FieldErrorMessageProps): ReactNode {
  if (!error) return null;
  return (
    <p id={id} className={cn("text-destructive mt-1 text-sm", className)}>
      {error}
    </p>
  );
}

export interface WithFieldErrorProps {
  /** Dotted path of the field in the request body, e.g. `address.postcode`. */
  field: string;
  /** Renders the control; spread `inputProps` onto it. */
  children: (state: FieldErrorState) => ReactNode;
  /** Set when the control shows the error itself, such as `CodeInput`'s `error` prop. */
  hideMessage?: boolean;
  /**
   * The control's current value. A change clears the field's error, for widgets
   * (selects, pickers, toggles) whose edits fire no native change event.
   */
  value?: unknown;
}

/**
 * Renders a control with its server field error: the control gets the ARIA
 * wiring through `inputProps` and the message renders under it. The field is
 * registered only while rendered, so an error for a hidden field falls back
 * to the form's banner.
 */
export function WithFieldError({
  field,
  children,
  hideMessage = false,
  value,
}: WithFieldErrorProps): ReactNode {
  const state = useFieldError(field);
  const { dismiss } = state;
  const lastValue = useRef(value);
  useEffect(() => {
    if (Object.is(lastValue.current, value)) return;
    lastValue.current = value;
    dismiss();
  }, [value, dismiss]);
  return (
    <>
      {children(state)}
      {!hideMessage && <FieldErrorMessage id={state.errorId} error={state.error} />}
    </>
  );
}
