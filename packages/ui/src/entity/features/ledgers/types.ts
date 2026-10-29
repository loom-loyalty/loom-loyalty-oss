/**
 * Ledger Feature Types
 *
 * Centralized type definitions for the ledgers feature.
 * Keeps types in a dedicated file per CLAUDE.md guidelines.
 */

import type { ProgramLedger } from "@loom-loyalty/sdk";

/**
 * Standard ledger fields - these have rich UI components
 */
export const LEDGER_STANDARD_FIELDS = [
  "programLedgerId",
  "program",
  "programCurrency",
  "createdDateTime",
  "modifiedDateTime",
] as const;

/**
 * Filter state for the ledgers list.
 */
export interface LedgerListFilters {
  search: string;
  currencyFilter: string | null;
}

/**
 * Props for the LedgerDetail component.
 */
export interface LedgerDetailProps {
  /** Ledger to display */
  ledger: ProgramLedger;
}
