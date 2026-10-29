import type { ReactNode } from "react";

import { cn } from "../lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../primitives/select";

interface CurrencySelectProps {
  /** Currently-selected currency code. */
  value: string | undefined;
  onChange: (value: string) => void;
  /** Available currency codes (e.g. POINTS, MILES). */
  codes: string[];
  /** Accessible label for the trigger; also the placeholder. */
  label?: string;
  className?: string;
}

/**
 * Presentational currency-code dropdown. Auto-hides when there is one code or
 * fewer — a single-currency tenant has nothing to switch between, so the
 * control disappears rather than showing a dead, single-option select.
 */
export function CurrencySelect({
  value,
  onChange,
  codes,
  label = "Currency",
  className,
}: CurrencySelectProps): ReactNode {
  if (codes.length <= 1) return null;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("w-auto min-w-[7rem]", className)} aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {codes.map((code) => (
          <SelectItem key={code} value={code}>
            {code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
