/**
 * LocalizedStringInput — multi-language text input.
 *
 * Maintains a record of language-code → string and emits stripped (no-empty,
 * no-whitespace-only) values to onChange so it stays compatible with the
 * shared `localizedString` Zod refinement. Newly added locales are tracked
 * internally until the user types something — pending entries never reach
 * the parent (or the form), so adding a locale doesn't trigger Zod refusal.
 *
 * Added locales are stored under their BCP 47 key (`es-MX`); `es_MX` is
 * accepted as input, and existing underscore keys still display and edit.
 * With `maxLength`, the active locale shows a counter that counts the way the
 * API does (Java `String.strip().length()`); over the limit the value is still
 * emitted, and the form blocks submit with `isOverLocalizedLimit`.
 */

import { normalizeLocaleKey } from "@loom-loyalty/core/utils";
import { Plus, X } from "lucide-react";
import * as React from "react";

import { cn } from "../lib/utils";
import { Button } from "../primitives/button";
import { Input } from "../primitives/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../primitives/select";
import { Textarea } from "../primitives/textarea";

export type LocalizedString = Record<string, string>;

export const LOCALE_TABBED_INPUT_DATA_ATTRS = (opts: {
  requiredLocale?: string;
}): Record<string, string> => {
  const attrs: Record<string, string> = { "data-widget": "locale-tabbed-input" };
  if (opts.requiredLocale) attrs["data-required-locale"] = opts.requiredLocale;
  return attrs;
};

export interface LocalizedStringInputProps {
  /** DOM id forwarded to the active input so a wrapping `<Label htmlFor>` resolves. */
  id?: string;
  /** Current localized string value */
  value?: LocalizedString;
  /** Callback when value changes (already stripped of empty/whitespace entries) */
  onChange?: (value: LocalizedString) => void;
  /** Additional CSS classes */
  className?: string;
  /** Disable all inputs */
  disabled?: boolean;
  /** Placeholder text for the input */
  placeholder?: string;
  /**
   * Use textarea instead of input for multi-line text
   * @default false
   */
  multiline?: boolean;
  /**
   * Default languages that cannot be removed. The first entry is treated as
   * the required locale and surfaced as `data-required-locale`. Pass `[]` to
   * opt out of any required locale (the data attr is then omitted).
   * @default ["en"]
   */
  defaultLanguages?: string[];
  /** ARIA invalid state for form validation (forwarded to the active input). */
  "aria-invalid"?: boolean;
  /** ARIA describedby for form validation (forwarded to the active input). */
  "aria-describedby"?: string;
  /**
   * Per-locale character limit, counted like the API (`localizedTextLength`).
   * Shows a counter for the active locale and an inline error when any locale
   * is over. The value is still emitted; block submit with `isOverLocalizedLimit`.
   */
  maxLength?: number;
  /**
   * Visible rows of the multiline textarea.
   * @default 4
   */
  rows?: number;
  /**
   * Renders the active locale's text for a Write/Preview toggle (for example,
   * a Markdown renderer). The toggle is shown only when this is given.
   */
  preview?: (text: string) => React.ReactNode;
  /**
   * The field's visible label, used to name the editor-mode toggle, the
   * preview and the language select, so several fields on one form stay
   * distinguishable to screen readers.
   */
  label?: string;
}

/**
 * Java `Character.isWhitespace`: Unicode space, line and paragraph separators
 * except the non-breaking ones (U+00A0, U+2007, U+202F), plus U+0009–U+000D and
 * U+001C–U+001F. U+FEFF and U+0085 are not whitespace in Java.
 */
const isJavaWhitespace = (code: number): boolean =>
  (code >= 0x09 && code <= 0x0d) ||
  (code >= 0x1c && code <= 0x20) ||
  code === 0x1680 ||
  (code >= 0x2000 && code <= 0x2006) ||
  (code >= 0x2008 && code <= 0x200a) ||
  code === 0x2028 ||
  code === 0x2029 ||
  code === 0x205f ||
  code === 0x3000;

/**
 * Length of `value` as the API counts it: Java `String.strip()` (which trims
 * `Character.isWhitespace`, a different set from JS `trim()`), then `length()`
 * in UTF-16 code units, so an emoji outside the BMP counts as 2.
 */
export function localizedTextLength(value: string): number {
  return javaStrip(value).length;
}

/**
 * `value` as Java `String.strip()` returns it: what the API stores, and blank
 * exactly when the API treats it as blank (a non-breaking space is text there).
 */
export function javaStrip(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && isJavaWhitespace(value.charCodeAt(start))) start++;
  while (end > start && isJavaWhitespace(value.charCodeAt(end - 1))) end--;
  return value.slice(start, end);
}

/** Locales of `value` whose text is over `maxLength` (counted like the API). */
const overLimitLocales = (value: LocalizedString | null | undefined, maxLength: number): string[] =>
  Object.entries(value ?? {})
    .filter(([, text]) => typeof text === "string" && localizedTextLength(text) > maxLength)
    .map(([locale]) => locale);

/** True when any locale of `value` is over `maxLength`; forms use it to block submit. */
export function isOverLocalizedLimit(
  value: LocalizedString | null | undefined,
  maxLength: number
): boolean {
  return overLimitLocales(value, maxLength).length > 0;
}

const stripEmpty = (record: LocalizedString): LocalizedString => {
  const out: LocalizedString = {};
  for (const [key, val] of Object.entries(record)) {
    if (typeof val !== "string") continue;
    if (val.trim().length > 0) out[key] = val;
  }
  return out;
};

function LocalizedStringInput({
  id,
  value,
  onChange,
  className,
  disabled = false,
  placeholder = "Enter text",
  multiline = false,
  defaultLanguages = ["en"],
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  maxLength,
  rows,
  preview,
  label,
}: LocalizedStringInputProps): React.ReactNode {
  // null isn't caught by JS default-param; memoized for stable identity in deps
  const safeValue = React.useMemo(() => value ?? {}, [value]);

  // Locales the user has touched in this session — added via "Add Language",
  // typed into, or seeded from the initial value. Kept internal for two
  // reasons: (1) prevents emitting `{[lang]: ""}` on Add (the localizedString
  // Zod refinement rejects empties); (2) keeps the language selector stable
  // across parent strip-then-rerender cycles, so the useEffect-language-reset
  // can't race async re-renders and truncate typing.
  const [registeredLanguages, setRegisteredLanguages] = React.useState<string[]>(() =>
    Object.keys(safeValue).filter((k) => !defaultLanguages.includes(k))
  );

  const languages = React.useMemo(() => {
    const valueLanguages = Object.keys(safeValue);
    return [...new Set([...defaultLanguages, ...valueLanguages, ...registeredLanguages])];
  }, [safeValue, defaultLanguages, registeredLanguages]);

  const [selectedLanguage, setSelectedLanguage] = React.useState<string>(languages[0] ?? "");
  const [isAddingLanguage, setIsAddingLanguage] = React.useState(false);
  const [newLanguageCode, setNewLanguageCode] = React.useState("");
  const [langCodeError, setLangCodeError] = React.useState("");
  const langCodeErrorId = React.useId();
  const counterId = React.useId();
  const limitErrorId = React.useId();
  const previewId = React.useId();
  const [mode, setMode] = React.useState<"write" | "preview">("write");

  React.useEffect(() => {
    if (selectedLanguage && languages.includes(selectedLanguage)) return;
    setSelectedLanguage(languages[0] ?? "");
  }, [languages, selectedLanguage]);

  const handleTextChange = (text: string) => {
    if (!selectedLanguage) return;
    const merged = { ...safeValue, [selectedLanguage]: text };
    onChange?.(stripEmpty(merged));
    if (!defaultLanguages.includes(selectedLanguage)) {
      setRegisteredLanguages((prev) =>
        prev.includes(selectedLanguage) ? prev : [...prev, selectedLanguage]
      );
    }
  };

  const handleAddLanguage = () => {
    const trimmed = newLanguageCode.trim();
    if (trimmed.length === 0) return;

    const langCode = normalizeLocaleKey(trimmed);
    if (!langCode) {
      setLangCodeError("Use a locale code like 'es' or 'es-MX'");
      return;
    }

    setLangCodeError("");

    // An existing key in any spelling (`fr_CA`) is selected, not duplicated as `fr-CA`.
    const existing = languages.find((l) => l === langCode || normalizeLocaleKey(l) === langCode);
    if (existing) {
      setNewLanguageCode("");
      setIsAddingLanguage(false);
      setSelectedLanguage(existing);
      return;
    }

    setRegisteredLanguages((prev) => (prev.includes(langCode) ? prev : [...prev, langCode]));
    setSelectedLanguage(langCode);
    setNewLanguageCode("");
    setIsAddingLanguage(false);
  };

  const dismissAddLanguage = () => {
    setIsAddingLanguage(false);
    setNewLanguageCode("");
    setLangCodeError("");
  };

  const handleRemoveLanguage = (languageCode: string) => {
    if (languages.length <= 1 || defaultLanguages.includes(languageCode)) return;

    setRegisteredLanguages((prev) => prev.filter((l) => l !== languageCode));

    const newValue = { ...safeValue };
    delete newValue[languageCode];

    if (selectedLanguage === languageCode) {
      const remaining = languages.filter((l) => l !== languageCode);
      const firstRemaining = remaining[0];
      if (firstRemaining) setSelectedLanguage(firstRemaining);
    }

    if (Object.prototype.hasOwnProperty.call(safeValue, languageCode)) {
      onChange?.(stripEmpty(newValue));
    }
  };

  const InputComponent = multiline ? Textarea : Input;
  const requiredLocale = defaultLanguages[0];
  const dataAttrs = LOCALE_TABBED_INPUT_DATA_ATTRS({ requiredLocale });

  const activeText =
    selectedLanguage && typeof safeValue[selectedLanguage] === "string"
      ? safeValue[selectedLanguage]
      : "";
  const hasLimit = typeof maxLength === "number";
  const activeLength = localizedTextLength(activeText);
  const activeOver = hasLimit && activeLength > maxLength;
  const otherOver = hasLimit
    ? overLimitLocales(safeValue, maxLength).filter((l) => l !== selectedLanguage)
    : [];
  const showLimitError = activeOver || otherOver.length > 0;

  let limitError = "";
  if (hasLimit && activeOver) {
    const over = activeLength - maxLength;
    limitError = `${over} ${over === 1 ? "character" : "characters"} over the ${maxLength}-character limit`;
    if (otherOver.length > 0) limitError += `. Also over: ${otherOver.join(", ").toUpperCase()}`;
  } else if (hasLimit && otherOver.length > 0) {
    limitError = `Over the ${maxLength}-character limit in ${otherOver.join(", ").toUpperCase()}`;
  }

  const describedBy =
    [ariaDescribedBy, hasLimit ? counterId : undefined, showLimitError ? limitErrorId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;
  const invalid = ariaInvalid || showLimitError ? true : undefined;
  const showPreview = preview !== undefined && mode === "preview";

  return (
    <div className={cn("space-y-2", className)} {...dataAttrs}>
      {preview !== undefined && (
        <div
          role="group"
          aria-label={label ? `${label} editor mode` : "Editor mode"}
          className="flex items-center gap-1"
        >
          {(["write", "preview"] as const).map((m) => (
            <Button
              key={m}
              type="button"
              variant={mode === m ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={mode === m}
              aria-controls={m === "preview" ? (id ?? previewId) : undefined}
              onClick={() => setMode(m)}
              className="min-h-11 min-w-11"
            >
              {m === "write" ? "Write" : "Preview"}
            </Button>
          ))}
        </div>
      )}

      {showPreview ? (
        <div
          // In preview the input is unmounted, so the field's id moves here and a wrapping
          // <Label htmlFor> still resolves.
          id={id ?? previewId}
          role="region"
          aria-label={label ? `${label} preview` : "Preview"}
          aria-describedby={describedBy}
          className={cn(
            "border-input-border bg-card text-foreground rounded-md border px-3 py-2 text-sm",
            multiline && "min-h-24"
          )}
        >
          {activeText.trim().length > 0 ? (
            preview(activeText)
          ) : (
            <p className="text-muted-foreground">Nothing to preview</p>
          )}
        </div>
      ) : (
        <InputComponent
          id={id}
          placeholder={placeholder}
          value={activeText}
          onChange={(e) => handleTextChange(e.target.value)}
          disabled={disabled || !selectedLanguage}
          rows={multiline ? (rows ?? 4) : undefined}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
      )}

      {hasLimit && (
        <div className="flex items-start justify-between gap-2 text-xs">
          {showLimitError ? (
            <p id={limitErrorId} className="text-destructive">
              {limitError}
            </p>
          ) : (
            <span />
          )}
          <p
            id={counterId}
            className={cn(
              "shrink-0 font-mono tabular-nums",
              activeOver ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {activeLength} / {maxLength}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={selectedLanguage}
          onValueChange={setSelectedLanguage}
          disabled={disabled || languages.length === 0}
        >
          <SelectTrigger
            className="w-[140px]"
            aria-label={label ? `${label} language` : "Language"}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languages.map((lang) => (
              <SelectItem key={lang} value={lang}>
                <span className="uppercase">{lang}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {languages.length > 1 && !defaultLanguages.includes(selectedLanguage) && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleRemoveLanguage(selectedLanguage)}
            disabled={disabled}
          >
            <X className="mr-1 h-4 w-4" />
            Remove
          </Button>
        )}

        {!isAddingLanguage ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAddingLanguage(true)}
            disabled={disabled}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Language
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-col gap-1">
              <Input
                placeholder="Lang code (e.g., es, es-MX)"
                value={newLanguageCode}
                onChange={(e) => {
                  setNewLanguageCode(e.target.value);
                  if (langCodeError) setLangCodeError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddLanguage();
                  } else if (e.key === "Escape") {
                    dismissAddLanguage();
                  }
                }}
                className="w-40"
                autoFocus
                disabled={disabled}
                aria-invalid={!!langCodeError}
                aria-describedby={langCodeError ? langCodeErrorId : undefined}
              />
              {langCodeError && (
                <p id={langCodeErrorId} role="alert" className="text-destructive text-xs">
                  {langCodeError}
                </p>
              )}
            </div>
            <Button type="button" size="sm" onClick={handleAddLanguage} disabled={disabled}>
              Add
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={dismissAddLanguage}
              disabled={disabled}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export { LocalizedStringInput };
