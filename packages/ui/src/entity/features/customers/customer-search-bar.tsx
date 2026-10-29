/**
 * CustomerSearchBar
 *
 * A multi-field search form for finding customers by name, email,
 * phone, or company. Mirrors the DataTable visual language: a `bg-muted`
 * header strip with title/status/actions sits on top of a `bg-card`
 * form body with a responsive grid of labelled inputs.
 *
 * Purely presentational — all state is managed by the consumer via
 * controlled props.
 *
 * WCAG: Uses a single LiveRegion for all dynamic status announcements
 * instead of per-field aria-live regions to avoid chaotic screen reader output.
 */

import { AtSign, Building2, Loader2, Phone, Search, User, UserSquare, X } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { LiveRegion } from "../../../a11y/live-region.js";
import { cn } from "../../../lib/utils.js";
import { Button } from "../../../primitives/button.js";
import { Input } from "../../../primitives/input.js";
import { Label } from "../../../primitives/label.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../primitives/select.js";
import {
  CUSTOMER_SEARCH_MIN_CHARS,
  type CustomerSearchFilters,
  type SearchFieldConfig,
} from "./types.js";

export interface CustomerSearchBarProps {
  /** Current filter values (controlled) */
  value: CustomerSearchFilters;
  /** Called when any field changes */
  onChange: (field: keyof CustomerSearchFilters, value: string) => void;
  /** Called when user clicks "Clear" */
  onClear: () => void;
  /** Whether the debounced criteria meet the minimum threshold */
  hasActiveCriteria: boolean;
  /** Whether a debounce timer is running */
  isDebouncing?: boolean;
  /** Whether the user has typed anything at all */
  hasInput?: boolean;
  className?: string;
}

const SEARCH_FIELDS: SearchFieldConfig[] = [
  {
    key: "firstName",
    label: "First name",
    placeholder: "e.g. Sarah",
    type: "text",
    autoComplete: "given-name",
    Icon: User,
  },
  {
    key: "lastName",
    label: "Last name",
    placeholder: "e.g. Chen",
    type: "text",
    autoComplete: "family-name",
    Icon: UserSquare,
  },
  {
    key: "emailAddress",
    label: "Email",
    placeholder: "sarah@example.com",
    type: "email",
    autoComplete: "email",
    Icon: AtSign,
  },
  {
    key: "phoneNumber",
    label: "Phone",
    placeholder: "555-0123",
    type: "tel",
    autoComplete: "tel",
    Icon: Phone,
  },
  {
    key: "companyName",
    label: "Company",
    placeholder: "Acme Corp",
    type: "text",
    autoComplete: "organization",
    Icon: Building2,
  },
];

const MATCH_MODE_OPTIONS = [
  { value: "CONTAINS", label: "Contains" },
  { value: "STARTS_WITH", label: "Starts with" },
  { value: "EQUALS", label: "Exact match" },
  { value: "ENDS_WITH", label: "Ends with" },
] as const;

/**
 * Visual-only character hint below each field. No aria-live — the single
 * LiveRegion at the bottom consolidates all announcements.
 */
function CharHint({ value }: { value: string }): ReactNode {
  const len = value.trim().length;
  const remaining = CUSTOMER_SEARCH_MIN_CHARS - len;
  const showHint = len > 0 && len < CUSTOMER_SEARCH_MIN_CHARS;

  if (!showHint) return null;

  return (
    <p className="text-muted-foreground mt-1 text-[11px]" aria-hidden="true">
      {remaining} more character{remaining !== 1 ? "s" : ""} needed
    </p>
  );
}

/**
 * Build a single consolidated status message for the LiveRegion.
 */
function buildStatusMessage(
  value: CustomerSearchFilters,
  isDebouncing: boolean,
  hasActiveCriteria: boolean,
  hasInput: boolean
): string {
  if (isDebouncing) return "Searching...";

  const fieldsWithPartialInput = SEARCH_FIELDS.filter((f) => {
    const len = value[f.key].trim().length;
    return len > 0 && len < CUSTOMER_SEARCH_MIN_CHARS;
  }).map((f) => f.label);

  if (fieldsWithPartialInput.length > 0) {
    return `${fieldsWithPartialInput.join(", ")}: enter at least ${CUSTOMER_SEARCH_MIN_CHARS} characters to search.`;
  }

  if (!hasActiveCriteria && hasInput) {
    return `Enter at least ${CUSTOMER_SEARCH_MIN_CHARS} characters in any field to search.`;
  }

  if (hasActiveCriteria) {
    return "Showing live results.";
  }

  return "";
}

export function CustomerSearchBar({
  value,
  onChange,
  onClear,
  hasActiveCriteria,
  isDebouncing = false,
  hasInput = false,
  className,
}: CustomerSearchBarProps): ReactNode {
  const statusMessage = useMemo(
    () => buildStatusMessage(value, isDebouncing, hasActiveCriteria, hasInput),
    [value, isDebouncing, hasActiveCriteria, hasInput]
  );

  return (
    <form
      role="search"
      aria-label="Customer search"
      onSubmit={(e) => e.preventDefault()}
      className={cn(
        "border-card-border bg-card overflow-hidden rounded-lg border shadow-sm",
        className
      )}
    >
      {/* Header strip — mirrors DataTable's bg-muted header */}
      <div className="border-chrome-border bg-muted flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Search className="text-chrome-muted-foreground h-4 w-4" aria-hidden="true" />
          <span className="text-foreground text-sm font-medium">Search customers</span>
        </div>

        {isDebouncing && (
          <span className="text-chrome-muted-foreground inline-flex items-center gap-1.5 text-xs">
            <Loader2 className="text-primary h-3 w-3 animate-spin" aria-hidden="true" />
            Searching
          </span>
        )}
        {hasActiveCriteria && !isDebouncing && (
          <span className="text-success-dark inline-flex items-center gap-1.5 text-xs">
            <span aria-hidden="true" className="bg-success h-1.5 w-1.5 rounded-full" />
            Live results
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Label
              htmlFor="customer-search-matchMode"
              className="text-chrome-muted-foreground text-xs font-medium"
            >
              Match
            </Label>
            <Select value={value.matchMode} onValueChange={(v) => onChange("matchMode", v)}>
              <SelectTrigger
                id="customer-search-matchMode"
                aria-label="Match mode"
                className="h-11 w-auto min-w-[110px] px-2 text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATCH_MODE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasInput && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-muted-foreground hover:text-foreground h-11 px-2 text-xs"
              aria-label="Clear all search criteria"
            >
              <X className="mr-1 h-3 w-3" aria-hidden="true" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Field grid */}
      <div className="p-4">
        <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-5">
          {SEARCH_FIELDS.map((field) => {
            const FieldIcon = field.Icon;
            const fieldId = `customer-search-${field.key}`;
            return (
              <div key={field.key} className="space-y-1">
                <Label htmlFor={fieldId} className="text-muted-foreground text-xs font-medium">
                  {field.label}
                </Label>
                <div className="relative">
                  <FieldIcon
                    aria-hidden="true"
                    className="text-muted-foreground/60 pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2"
                  />
                  <Input
                    id={fieldId}
                    type={field.type}
                    placeholder={field.placeholder}
                    value={value[field.key]}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    autoComplete={field.autoComplete}
                    className="h-9 pl-9"
                  />
                </div>
                <CharHint value={value[field.key]} />
              </div>
            );
          })}
        </div>

        {!hasActiveCriteria && hasInput && (
          <p className="text-muted-foreground mt-3 text-xs" aria-hidden="true">
            Enter at least {CUSTOMER_SEARCH_MIN_CHARS} characters in any field to search.
          </p>
        )}
      </div>

      <LiveRegion message={statusMessage} />
    </form>
  );
}
