/**
 * CodeInput - Auto-generates a code/slug from a source value
 *
 * Features:
 * - Auto-generates code from source value (e.g., "My Program" → "my-program")
 * - Multiple format options (kebab-case, dot.case, UPPER_SNAKE_CASE)
 * - Allows manual editing (disables auto-generation once edited)
 * - Optional reset button to re-enable auto-generation
 * - Customizable transform function for advanced use cases
 */

import {
  EVENT_TYPE_CODE_MESSAGE,
  isEventTypeCode,
  isResourceCode,
  RESOURCE_CODE_MESSAGE,
  toEventTypeCode,
  toResourceCode,
} from "@loom-loyalty/conventions";
import { RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import { Input, type InputProps } from "../primitives/input";

/**
 * Supported code formats
 */
export type CodeFormat =
  | "kebab-case" // my-loyalty-program (default)
  | "dot-case" // my.loyalty.program
  | "upper-snake-case"; // MY_LOYALTY_PROGRAM

/**
 * Which API convention this field's value has to satisfy, if any.
 *
 * **Opt in explicitly per field. Do not infer it from {@link CodeFormat}.** The
 * display format and the validation rule are different questions, and conflating
 * them breaks both directions:
 *
 *   - `upper-snake-case` can never satisfy the resource-code pattern, so mapping
 *     it there would put a permanent error on a field the API is happy with;
 *   - not every `code` field on a form sheet is a resource code. Metadata and
 *     MetadataType codes are permanently exempt, a Coupon code is deliberately
 *     unvalidated by the API, Organization has its own pattern, and the
 *     customer sheet's field is a `companyCode`. Validating any of those would
 *     reject values the API accepts.
 *
 * Decide from the entity's create/update DTO, not from how the field looks.
 */
export type CodePattern = "resource" | "event-type" | "none";

/**
 * Returns the API's own validation message when `value` would be rejected.
 *
 * An empty value is never an error here — a blank code is a required-field
 * concern, and reporting a pattern violation on an untouched field would be
 * noise. Sheets already gate submit on their own required handling.
 */
export function validateCode(value: string, pattern: CodePattern): string | null {
  if (pattern === "none" || value === "") return null;
  if (pattern === "resource") {
    return isResourceCode(value) ? null : RESOURCE_CODE_MESSAGE;
  }
  return isEventTypeCode(value) ? null : EVENT_TYPE_CODE_MESSAGE;
}

export const CODE_INPUT_DATA_ATTRS = (opts: {
  format: CodeFormat;
  hasCustomTransform: boolean;
}): Record<string, string> => ({
  "data-widget": "code-input",
  "data-format": opts.hasCustomTransform ? "custom" : opts.format,
});

/**
 * Transform functions for each format
 */
const formatTransforms: Record<CodeFormat, (value: string) => string> = {
  /**
   * Kebab case: "My Loyalty Program" → "my-loyalty-program"
   *
   * Delegates to `toResourceCode` rather than a second hand-rolled sanitizer:
   * the pre-#772 version stripped leading/trailing hyphens BEFORE truncating to
   * 50 characters, so a source value whose 50th character landed on a hyphen
   * could still produce a trailing-hyphen code — invalid against the
   * resource-code pattern most of this format's callers create codes against
   * (Badge, Tier, Program, ProgramCurrency, ...). Sharing one generator also
   * means what this suggests and what {@link validateCode} accepts cannot drift
   * apart.
   *
   * The 50-character cap is this widget's own, deliberately narrower than the
   * convention's 63, so a generated code stays readable in the field. Re-trimming
   * after the slice is what makes that safe.
   *
   * Empty fallback (not "generated") preserves this widget's existing behavior of
   * showing an empty field rather than a placeholder code while the source value
   * has no valid characters yet.
   *
   * One user-visible delta from the pre-#772 version: punctuation now becomes a
   * separator instead of being deleted, so `O'Brien Points` gives
   * `o-brien-points` where it used to give `obrien-points`.
   */
  "kebab-case": (value: string) => toResourceCode(value, "").slice(0, 50).replace(/-+$/g, ""),

  /**
   * Dot case: "My App.Purchase Completed" → "my-app.purchase-completed"
   *
   * Delegates to the shared event-type-code generator, for the same reason.
   *
   * **Behaviour change**: this used to turn spaces into dots
   * (`My Loyalty Program` → `my.loyalty.program`), which invented a namespace
   * the user never asked for. Dots are now *preserved* as segment separators and
   * everything else within a segment hyphenates, matching how event-type codes
   * are actually namespaced. A name with no dot in it yields a single segment.
   */
  "dot-case": (value: string) => toEventTypeCode(value, ""),

  /**
   * Upper snake case: "My Loyalty Program" → "MY_LOYALTY_PROGRAM"
   */
  "upper-snake-case": (value: string) =>
    value
      .toUpperCase()
      .replace(/[^A-Z0-9\s_]/g, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 50),
};

/**
 * Get transform function for a format
 */
function getTransformForFormat(format: CodeFormat): (value: string) => string {
  return formatTransforms[format];
}

export interface CodeInputProps extends Omit<InputProps, "value" | "onChange"> {
  /** The source value to generate code from (typically a name field) */
  sourceValue: string;
  /** Current code value */
  value: string;
  /** Called when code changes */
  onChange: (value: string) => void;
  /** Code format preset (defaults to "kebab-case") */
  format?: CodeFormat;
  /** Custom transform function (overrides format if provided) */
  transform?: (source: string) => string;
  /** Show reset button when manually edited */
  showReset?: boolean;
  /** Label for reset button (accessible) */
  resetLabel?: string;
  /** Additional class for the wrapper div */
  wrapperClassName?: string;
  /**
   * Which API convention the value must satisfy. Defaults to `"none"` — opt in
   * per field, see {@link CodePattern}.
   */
  pattern?: CodePattern;
  /**
   * Validation message to display, overriding whatever `pattern` would compute.
   *
   * Pass `codeInput.error` when pairing this with {@link useCodeInput} so the
   * hook stays the single source of truth; omit it when using the component
   * standalone and let `pattern` do the work.
   */
  error?: string | null;
}

export function CodeInput({
  sourceValue,
  value,
  onChange,
  format = "kebab-case",
  transform,
  showReset = true,
  resetLabel = "Reset to auto-generated value",
  wrapperClassName,
  className,
  disabled,
  pattern = "none",
  error,
  ...props
}: CodeInputProps) {
  // Use custom transform if provided, otherwise use format-based transform
  const transformFn = transform ?? getTransformForFormat(format);

  // Track whether the code was chosen rather than derived.
  const [isManuallyEdited, setIsManuallyEdited] = useState(false);
  // The last code this field derived, so a value it didn't derive is known to
  // be a saved or chosen code, whenever it arrives. Once one has arrived the
  // field stops deriving until Reset.
  const lastDerivedRef = useRef<string | undefined>(undefined);
  const keepsSavedCodeRef = useRef(false);

  // Auto-generate code from source value when not manually edited.
  //
  // `disabled` short-circuits this, and that guard is load-bearing rather than
  // cosmetic. This component tracks its own `isManuallyEdited`, separate from
  // `useCodeInput`'s, so when the two are paired this effect saw a fresh `false`
  // and overwrote the hook's `locked` value with one derived from `sourceValue`.
  // In edit mode that silently rewrote a persisted code from the entity's name —
  // a record coded `FINISH_ONBOARDING` and named "Spend 100" submitted
  // `spend-100` on an unrelated edit. It went unnoticed because the sheets'
  // fixtures happened to use codes that matched their names.
  //
  // A disabled field must never rewrite its own value.
  //
  // Only an empty value or one this field derived is replaced. Anything else is
  // a saved or chosen code (an edit sheet whose record loaded before or after
  // mount), so it counts as manual and is never rewritten.
  useEffect(() => {
    if (disabled || isManuallyEdited || keepsSavedCodeRef.current || !sourceValue) return;
    const generated = transformFn(sourceValue);
    if (generated === value) {
      lastDerivedRef.current = value;
    } else if (value === "" || value === lastDerivedRef.current) {
      lastDerivedRef.current = generated;
      onChange(generated);
    } else {
      keepsSavedCodeRef.current = true;
    }
  }, [disabled, sourceValue, isManuallyEdited, transformFn, onChange, value]);

  // Handle user input
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsManuallyEdited(true);
    onChange(e.target.value);
  };

  // Reset to auto-generation mode
  const handleReset = () => {
    setIsManuallyEdited(false);
    keepsSavedCodeRef.current = false;
    // Mark the current value as derived, so the effect replaces it even if the
    // parent applies the new value a render later.
    lastDerivedRef.current = value;
    const generated = transformFn(sourceValue);
    onChange(generated);
  };

  const showResetButton = showReset && isManuallyEdited && !disabled;
  const dataAttrs = CODE_INPUT_DATA_ATTRS({ format, hasCustomTransform: transform !== undefined });

  // An explicitly-passed `error` wins, including an explicit null, so a caller
  // pairing this with useCodeInput cannot end up with two disagreeing verdicts.
  // A disabled field self-validates to null for the same reason `useCodeInput`
  // exempts `locked`: complaining about a value the user cannot reach is noise,
  // not help.
  const resolvedError =
    error !== undefined ? error : disabled ? null : validateCode(value, pattern);
  const errorId = useId();

  // Compose rather than replace: a consumer may already describe this field with
  // a hint paragraph, and both associations have to survive.
  const describedBy =
    [props["aria-describedby"], resolvedError != null ? errorId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className={cn(wrapperClassName)} {...dataAttrs}>
      <div className="relative">
        <Input
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className={cn(
            showResetButton && "pr-10",
            resolvedError != null && "border-destructive focus-visible:ring-destructive",
            className
          )}
          {...props}
          // AFTER the spread, deliberately. These have to win: a consumer that
          // passes its own `aria-describedby` (a hint paragraph, say) must not
          // silently drop the error association, which is the whole point of
          // the feature. The caller's value is composed in rather than
          // discarded, so the field keeps pointing at both.
          aria-invalid={resolvedError != null || props["aria-invalid"]}
          aria-describedby={describedBy}
        />
        {showResetButton && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
            onClick={handleReset}
            aria-label={resetLabel}
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>
      {/*
        Deliberately NOT role="alert". `aria-invalid` plus an `aria-describedby`
        association is the correct pattern for field-level validation: the
        message is announced when focus reaches the field, rather than
        interrupting whatever the user is doing. `role="alert"` is for
        form-level and page-level errors — FormSheet's own `error` slot — and
        using it here would both double-announce and make every
        `queryByRole("alert")` assertion in a consuming sheet's tests start
        counting this field.
      */}
      {resolvedError != null && (
        <p id={errorId} data-slot="code-input-error" className="text-destructive mt-1.5 text-sm">
          {resolvedError}
        </p>
      )}
    </div>
  );
}

/**
 * Hook for managing code input state
 * Alternative to using the component directly
 *
 * Uses derived state pattern: when not manually edited, value is computed
 * from sourceValue during render rather than synced via useEffect.
 */
export function useCodeInput(
  sourceValue: string,
  options: {
    format?: CodeFormat;
    transform?: (source: string) => string;
    initialValue?: string;
    /** When true, value is fixed to initialValue (for edit mode) */
    locked?: boolean;
    /** Called when the auto-generated value changes (not manually edited).
     *  Use this to sync external state (e.g., wizard updateData) that wouldn't
     *  otherwise be notified, since CodeInput's onChange only fires on user edits
     *  when paired with this hook. */
    onAutoGenerate?: (value: string) => void;
    /**
     * Which API convention the value must satisfy. Defaults to `"none"` — opt in
     * per field, see {@link CodePattern}.
     */
    pattern?: CodePattern;
  } = {}
) {
  const {
    format = "kebab-case",
    transform,
    initialValue,
    locked,
    onAutoGenerate,
    pattern = "none",
  } = options;
  const transformFn = transform ?? getTransformForFormat(format);

  // Store manual value only - null means "use auto-generated".
  // If initialValue matches the auto-generated value, stay in auto mode so the
  // code field continues to track name changes (fixes wizard return visits where
  // onAutoGenerate had synced the generated code to parent state).
  // When locked, always use initialValue to prevent re-derivation in edit mode.
  const [manualValue, setManualValue] = useState<string | null>(() => {
    if (locked && initialValue != null) return initialValue;
    if (initialValue == null) return null;
    if (initialValue === transformFn(sourceValue)) return null;
    return initialValue;
  });

  // Derive isManuallyEdited and value from state
  const isManuallyEdited = manualValue !== null;
  const value = isManuallyEdited ? manualValue : transformFn(sourceValue);

  // Notify parent when auto-generated value changes.
  const prevAutoValueRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!isManuallyEdited && prevAutoValueRef.current !== value) {
      prevAutoValueRef.current = value;
      if (value) onAutoGenerate?.(value);
    }
  }, [value, isManuallyEdited, onAutoGenerate]);

  const handleChange = (newValue: string) => {
    setManualValue(newValue);
  };

  const reset = () => {
    setManualValue(null);
  };

  return {
    value,
    onChange: handleChange,
    reset,
    isManuallyEdited,
    /**
     * The API's validation message when the current value would be rejected,
     * or `null`. Always `null` when `pattern` is `"none"` (the default), when the
     * value is empty, and when `locked`. Gate submit on this.
     *
     * **Locked values are exempt, deliberately.** `locked` means edit mode: the
     * value is pinned to the persisted code and the field is rendered disabled.
     * Reporting an error there would disable Save over a value the user has no
     * way to change — so editing anything else about a legacy record, a name or
     * a description, would become impossible through the UI. That is not
     * hypothetical: pre-convention codes are widespread in existing tenant data.
     *
     * A legacy code failing on update is a real problem, but it is the API's to
     * solve (`code` is `@NotBlank` as well as
     * pattern-validated, so the frontend can neither send it nor omit it). Until
     * that lands, letting the request go and surfacing the server's rejection is
     * strictly better than a disabled button with no explanation.
     */
    error: locked ? null : validateCode(value, pattern),
  };
}

/** Export format transforms for custom use */
export { formatTransforms };
