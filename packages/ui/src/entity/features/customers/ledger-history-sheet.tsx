/**
 * Ledger History Sheet — Full Transaction History
 *
 * Right-side sheet with currency selector, balance summary cards,
 * and server-side paginated ledger table.
 * Pure presentational — all data + callbacks via props.
 */

"use client";

import { AlertTriangle, Clock, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import type { Column, PaginationConfig } from "../../../data-display/data-table";
import { DataTable } from "../../../data-display/data-table";
import { Badge } from "../../../primitives/badge";
import { Card, CardContent } from "../../../primitives/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../primitives/select";
import { Separator } from "../../../primitives/separator";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../../../primitives/sheet";
import { EntityLinkButton } from "./entity-link-button";
import { ledgerColumns } from "./ledger-columns";
import type { CurrencyBalance, LedgerEntry } from "./types";
import { formatCurrencyValue } from "./types";

// ─── Props ──────────────────────────────────────────────────────────────────

export interface LedgerHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currencies: CurrencyBalance[];
  /** Currently displayed ledger entries for the selected page + currency */
  entries: LedgerEntry[];
  /** Total entry count for pagination */
  totalEntries: number;
  /** Current page (1-indexed to match PaginationConfig) */
  page: number;
  /** Page size */
  pageSize: number;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Currently selected currency code */
  selectedCurrencyCode: string | null;
  /** Callback when currency selection changes */
  onCurrencyChange: (currencyCode: string) => void;
  /** Loading state for entries */
  isLoading?: boolean;
  /**
   * Opens the detail view for the event that produced an entry. Only invoked
   * for events present in `loadedEventIds`; when omitted, the originating event
   * ID still renders, just as plain text.
   */
  onEventClick?: (eventId: string) => void;
  /**
   * Event IDs currently loaded and therefore openable. An entry's originating
   * event always exists, but the events query is page-capped — linking to one
   * that isn't loaded would open an empty sheet.
   */
  loadedEventIds?: ReadonlySet<string>;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function LedgerHistorySheet({
  open,
  onOpenChange,
  currencies,
  entries,
  totalEntries,
  page,
  pageSize,
  onPageChange,
  selectedCurrencyCode,
  onCurrencyChange,
  isLoading = false,
  onEventClick,
  loadedEventIds,
}: LedgerHistorySheetProps): ReactNode {
  const selectedCurrency = currencies.find((c) => c.currencyCode === selectedCurrencyCode);
  const hasMultipleCurrencies = currencies.length > 1;

  const columns = useMemo<Column<LedgerEntry>[]>(
    () => [
      ...ledgerColumns,
      {
        key: "event",
        header: "Event",
        render: (entry) =>
          entry.referenceId ? (
            <EntityLinkButton
              id={entry.referenceId}
              entityLabel="event"
              onClick={
                onEventClick && loadedEventIds?.has(entry.referenceId) ? onEventClick : undefined
              }
            />
          ) : (
            <span className="text-muted-foreground text-xs">&mdash;</span>
          ),
      },
    ],
    [onEventClick, loadedEventIds]
  );

  const pagination: PaginationConfig | undefined =
    totalEntries > pageSize
      ? {
          page,
          pageSize,
          total: totalEntries,
          onPageChange,
        }
      : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Transaction History</SheetTitle>
          <SheetDescription>
            {selectedCurrency
              ? `${selectedCurrency.currencyName} — ${formatCurrencyValue(selectedCurrency.available, selectedCurrency.decimalPlaces, selectedCurrency.symbol)} available`
              : "All currency transactions"}
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-5">
          {/* Currency Selector */}
          {hasMultipleCurrencies && (
            <div>
              <Select value={selectedCurrencyCode ?? undefined} onValueChange={onCurrencyChange}>
                <SelectTrigger className="w-full sm:w-64" aria-label="Filter by currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies
                    .slice()
                    .sort((a, b) => b.available - a.available)
                    .map((c) => (
                      <SelectItem key={c.currencyCode} value={c.currencyCode}>
                        {c.currencyName} —{" "}
                        <span className="tabular-nums">
                          {formatCurrencyValue(c.available, c.decimalPlaces, c.symbol)}
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Balance Summary Cards */}
          {selectedCurrency && <BalanceSummary currency={selectedCurrency} />}

          {/* Ledger Table */}
          <div>
            <DataTable
              columns={columns}
              data={entries}
              getRowKey={(entry) => entry.entryId}
              pagination={pagination}
              loading={isLoading}
              emptyMessage="No transactions found."
            />
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

// ─── Balance Summary ────────────────────────────────────────────────────────

function BalanceSummary({ currency }: { currency: CurrencyBalance }): ReactNode {
  const { decimalPlaces, symbol } = currency;
  const hasPending = currency.pending > 0;
  const hasExpiring = currency.expiringByDate.length > 0;
  const expiringTotal = currency.expiringByDate.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {/* Available Balance Card */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Wallet className="text-accent h-7 w-7 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-foreground text-2xl font-bold tabular-nums">
                {formatCurrencyValue(currency.available, decimalPlaces, symbol)}
              </p>
              <p className="text-muted-foreground text-xs">Available Balance</p>
            </div>
          </div>

          {/* Pending / Expiring badges */}
          {(hasPending || hasExpiring) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {hasPending && (
                <Badge variant="outline" className="text-xs" role="status">
                  <Clock className="mr-1 h-3 w-3" aria-hidden="true" />
                  {formatCurrencyValue(currency.pending, decimalPlaces, symbol)} pending
                </Badge>
              )}
              {hasExpiring && expiringTotal > 0 && (
                <Badge variant="outline" className="text-xs" role="status">
                  <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
                  {formatCurrencyValue(expiringTotal, decimalPlaces, symbol)} expiring
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lifetime Statistics Card */}
      <Card className="shadow-sm">
        <CardContent className="space-y-2.5 p-4">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Lifetime Statistics
          </p>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <TrendingUp className="text-success-dark h-3.5 w-3.5" aria-hidden="true" />
              Total Earned
            </span>
            <span className="text-success-dark text-sm font-medium tabular-nums">
              {formatCurrencyValue(currency.earned, decimalPlaces, symbol)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <TrendingDown className="text-destructive h-3.5 w-3.5" aria-hidden="true" />
              Total Debited
            </span>
            <span className="text-destructive text-sm font-medium tabular-nums">
              {formatCurrencyValue(currency.debited, decimalPlaces, symbol)}
            </span>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-foreground text-sm font-medium">Posted Balance</span>
            <span className="text-foreground text-sm font-semibold tabular-nums">
              {formatCurrencyValue(currency.posted, decimalPlaces, symbol)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
