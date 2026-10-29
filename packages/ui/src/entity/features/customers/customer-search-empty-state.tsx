/**
 * CustomerSearchEmptyState
 *
 * Displays contextual guidance when no customer search results are shown.
 * Handles two states:
 * 1. Pre-search: encourages the user to start searching
 * 2. No results: suggests adjusting search terms
 */

import { Search, UserX } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../../lib/utils.js";

export interface CustomerSearchEmptyStateProps {
  /** Whether a search has been attempted (no results vs. not yet searched) */
  hasSearched: boolean;
  className?: string;
}

const SEARCHABLE_FIELDS = [
  "First name",
  "Last name",
  "Email address",
  "Phone number",
  "Company name",
];

export function CustomerSearchEmptyState({
  hasSearched,
  className,
}: CustomerSearchEmptyStateProps): ReactNode {
  if (hasSearched) {
    return (
      <section
        className={cn(
          "border-border bg-card flex flex-col items-center justify-center rounded-lg border py-20 text-center shadow-sm",
          className
        )}
        aria-label="No results"
      >
        <div className="bg-muted mb-5 rounded-full p-4">
          <UserX className="text-muted-foreground h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="text-foreground mb-1.5 font-serif text-xl font-semibold">
          No customers found
        </h2>
        <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
          No customers match your search criteria. Try broadening your search terms or switching to
          a different match mode.
        </p>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "border-border bg-card flex flex-col items-center justify-center rounded-lg border py-20 text-center shadow-sm",
        className
      )}
      aria-label="Customer search"
    >
      <div className="bg-primary/10 mb-5 rounded-full p-4">
        <Search className="text-primary h-7 w-7" aria-hidden="true" />
      </div>
      <h2 className="text-foreground mb-1.5 font-serif text-xl font-semibold">
        Search for customers
      </h2>
      <p className="text-muted-foreground mb-6 max-w-md text-sm leading-relaxed">
        Enter at least 3 characters in any search field above to find customers. Results will appear
        automatically as you type.
      </p>
      <div className="bg-muted/50 border-border rounded-lg border px-5 py-3">
        <p className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wider uppercase">
          Available search fields
        </p>
        <ul
          className="flex flex-wrap justify-center gap-x-4 gap-y-1"
          aria-label="Available search fields"
        >
          {SEARCHABLE_FIELDS.map((field) => (
            <li key={field} className="text-foreground flex items-center gap-1.5 text-sm">
              <span className="bg-primary/30 h-1 w-1 rounded-full" aria-hidden="true" />
              {field}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
