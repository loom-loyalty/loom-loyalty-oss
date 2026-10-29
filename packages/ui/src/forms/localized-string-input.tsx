/**
 * LocalizedStringInput — multi-language text input.
 *
 * Maintains a record of language-code → string and emits stripped (no-empty,
 * no-whitespace-only) values to onChange so it stays compatible with the
 * shared `localizedString` Zod refinement. Newly added locales are tracked
 * internally until the user types something — pending entries never reach
 * the parent (or the form), so adding a locale doesn't trigger Zod refusal.
 */

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
}

const LOCALE_INPUT_PATTERN = /^([a-z]{2})(?:_([a-z]{2}))?$/i;

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

    const match = trimmed.match(LOCALE_INPUT_PATTERN);
    if (!match) {
      setLangCodeError("Use a locale code like 'es' or 'fr_CA'");
      return;
    }

    const langPart = match[1] ?? "";
    const regionPart = match[2];
    const langCode = regionPart
      ? `${langPart.toLowerCase()}_${regionPart.toUpperCase()}`
      : langPart.toLowerCase();

    setLangCodeError("");

    if (languages.includes(langCode)) {
      setNewLanguageCode("");
      setIsAddingLanguage(false);
      setSelectedLanguage(langCode);
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

  return (
    <div className={cn("space-y-2", className)} {...dataAttrs}>
      <InputComponent
        id={id}
        placeholder={placeholder}
        value={
          selectedLanguage && typeof safeValue[selectedLanguage] === "string"
            ? safeValue[selectedLanguage]
            : ""
        }
        onChange={(e) => handleTextChange(e.target.value)}
        disabled={disabled || !selectedLanguage}
        rows={multiline ? 4 : undefined}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={selectedLanguage}
          onValueChange={setSelectedLanguage}
          disabled={disabled || languages.length === 0}
        >
          <SelectTrigger className="w-[140px]">
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
                placeholder="Lang code (e.g., es, fr_CA)"
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
