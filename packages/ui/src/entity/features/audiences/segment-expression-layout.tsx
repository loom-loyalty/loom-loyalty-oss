/**
 * Segment Expression Layout
 *
 * Presentational stacked layout for the segment expression builder.
 * Full-width expression builder on top, sticky preview bar below,
 * and collapsible sections (sample customers, compiled SQL) at the bottom.
 *
 * No data fetching — all data passed via props/slots.
 */

import { formatShortDate } from "@loom-loyalty/core";
import { ChevronDown, ChevronRight, Copy, RefreshCw, Users } from "lucide-react";
import { useCallback, useId, useState, type ReactNode } from "react";
import { cn } from "../../../lib/utils.js";
import { Badge } from "../../../primitives/badge.js";
import { Button } from "../../../primitives/button.js";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../primitives/collapsible.js";
import { Skeleton } from "../../../primitives/skeleton.js";

// -- Types --

export type CostLevel = "LOW" | "MEDIUM" | "HIGH";

export interface PreviewData {
  estimatedCount: number | null;
  costLevel: CostLevel | null;
  compiledSql: string | null;
}

export interface SampleCustomer {
  id: string;
  name?: string;
  email?: string;
  currentTier?: string;
  totalSpend?: number;
  joinDate?: string;
}

export interface SegmentExpressionLayoutProps {
  /** The expression builder component (full width slot) */
  expressionBuilder: ReactNode;
  /** Preview data from the API */
  preview: PreviewData | null;
  /** Whether the preview is currently loading */
  previewLoading: boolean;
  /** Whether the preview data is stale (expression changed since last preview) */
  previewStale: boolean;
  /** Error message from the preview API */
  previewError: string | null;
  /** Callback to refresh the preview */
  onRefreshPreview?: () => void;
  /** Sample customers hydrated from preview response */
  sampleCustomers: SampleCustomer[];
  /** Whether sample customers are loading */
  sampleCustomersLoading: boolean;
  /** Number of customers that failed to load */
  sampleCustomersFailedCount?: number;
  /**
   * True when nested inside another surface's own chrome (e.g. a Dialog's
   * scrollable body) rather than shown standalone on a page. Drops the sticky
   * positioning, shadow, and border so this layout doesn't seam against the
   * host's own edges. Defaults to false (standalone).
   */
  embedded?: boolean;
}

// -- Preview Sticky Bar --

function PreviewStickyBar({
  preview,
  loading,
  stale,
  error,
  onRefresh,
  embedded,
}: {
  preview: PreviewData | null;
  loading: boolean;
  stale: boolean;
  error: string | null;
  onRefresh?: () => void;
  embedded?: boolean;
}): ReactNode {
  return (
    <div
      className={cn(
        "bg-card flex min-h-12 flex-wrap items-center gap-3 px-4 py-2",
        embedded
          ? "border-border rounded-md border"
          : "border-border sticky bottom-0 z-10 border-t shadow-sm"
      )}
      role="status"
      aria-live="polite"
      aria-label={
        error
          ? "Preview unavailable"
          : preview
            ? `Segment preview: approximately ${preview.estimatedCount?.toLocaleString() ?? 0} customers match${preview.costLevel ? `, computation cost ${preview.costLevel.toLowerCase()}` : ""}`
            : "Segment preview"
      }
    >
      {/* Count */}
      <div className="flex items-center gap-1.5">
        <Users className="text-muted-foreground h-3.5 w-3.5" />
        {loading && !preview ? (
          <Skeleton className="h-5 w-20" />
        ) : error ? (
          <span className="text-muted-foreground text-sm">Preview unavailable</span>
        ) : (
          <span
            className={cn(
              "text-sm font-medium",
              stale && "animate-pulse",
              preview?.estimatedCount === 0 ? "text-muted-foreground" : "text-foreground"
            )}
          >
            ~{(preview?.estimatedCount ?? 0).toLocaleString()} customers
            {stale && loading && " (updating...)"}
          </span>
        )}
      </div>

      {/* Cost indicator */}
      <CostIndicator costLevel={preview?.costLevel ?? null} />

      {/* Refresh / Retry */}
      <div className="ml-auto flex items-center gap-1.5">
        {error && onRefresh && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            className="text-primary h-7 px-2 text-xs"
          >
            Retry
          </Button>
        )}
        {!error && onRefresh && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-7 w-7 p-0"
            aria-label="Refresh preview"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        )}
      </div>
    </div>
  );
}

// -- Cost Indicator --

const COST_STYLES: Record<CostLevel, string> = {
  LOW: "bg-primary/10 text-primary",
  MEDIUM: "bg-accent/10 text-accent-dark",
  HIGH: "bg-destructive/10 text-destructive",
};

function CostIndicator({ costLevel }: { costLevel: CostLevel | null }): ReactNode {
  if (!costLevel) {
    return (
      <span className="text-muted-foreground text-xs" aria-label="Computation cost unknown">
        --
      </span>
    );
  }

  return (
    <Badge
      className={cn("text-[11px] font-medium", COST_STYLES[costLevel])}
      role="img"
      aria-label={`Computation cost: ${costLevel}`}
    >
      Cost: {costLevel}
    </Badge>
  );
}

// -- Sample Customer Cards --

function SampleCustomerCards({
  customers,
  loading,
  failedCount,
}: {
  customers: SampleCustomer[];
  loading: boolean;
  failedCount?: number;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (!loading && customers.length === 0 && !failedCount) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="hover:bg-muted/50 flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-sm transition-colors"
          aria-expanded={open}
          aria-controls={panelId}
        >
          {open ? (
            <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
          )}
          <span className="text-foreground text-xs font-medium">
            Sample Customers ({loading ? "..." : customers.length})
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent id={panelId}>
        <div className="px-4 pb-3">
          {loading ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="border-border rounded-md border p-3">
                  <Skeleton className="mb-2 h-4 w-32" />
                  <Skeleton className="mb-1 h-3 w-48" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : customers.length === 0 ? (
            <p className="text-muted-foreground py-2 text-center text-xs">No matching customers</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {customers.map((customer) => (
                  <article
                    key={customer.id}
                    className="border-border rounded-md border p-3"
                    role="article"
                    aria-label={customer.name ?? customer.id}
                  >
                    <p className="text-foreground text-sm leading-tight font-medium">
                      {customer.name ?? customer.id}
                    </p>
                    {customer.email && (
                      <p className="text-muted-foreground text-xs">{maskEmail(customer.email)}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {customer.currentTier && (
                        <Badge variant="outline" className="text-[10px]">
                          {customer.currentTier}
                        </Badge>
                      )}
                      {customer.totalSpend != null && (
                        <span className="font-mono text-[11px] tabular-nums">
                          ${customer.totalSpend.toLocaleString()}
                        </span>
                      )}
                      {customer.joinDate && (
                        <time
                          dateTime={customer.joinDate}
                          className="text-muted-foreground text-[10px]"
                        >
                          Joined {formatShortDate(customer.joinDate)}
                        </time>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              {!!failedCount && failedCount > 0 && (
                <p className="text-muted-foreground mt-2 text-xs">
                  {failedCount} customer{failedCount !== 1 ? "s" : ""} could not be loaded
                </p>
              )}
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// -- Compiled SQL View --

function CompiledSqlView({ sql }: { sql: string | null }): ReactNode {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const panelId = useId();

  const handleCopy = useCallback(async () => {
    if (!sql) return;
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable or permission denied — silently ignore
    }
  }, [sql]);

  if (!sql) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="hover:bg-muted/50 flex w-full items-center gap-2 rounded-md px-4 py-2 text-left text-sm transition-colors"
          aria-expanded={open}
          aria-controls={panelId}
        >
          {open ? (
            <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
          )}
          <span className="text-foreground text-xs font-medium">View Compiled SQL</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent id={panelId}>
        <div className="relative px-4 pb-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="absolute top-1 right-5 z-10 h-7 px-2 text-xs"
            aria-label="Copy SQL to clipboard"
          >
            <Copy className="mr-1 h-3 w-3" />
            {copied ? "Copied" : "Copy"}
          </Button>
          <pre
            className="bg-surface max-h-[200px] overflow-auto rounded-md p-3 font-mono text-xs"
            aria-label="Compiled SQL query"
          >
            <code>{sql}</code>
          </pre>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// -- Main Layout --

export function SegmentExpressionLayout({
  expressionBuilder,
  preview,
  previewLoading,
  previewStale,
  previewError,
  onRefreshPreview,
  sampleCustomers,
  sampleCustomersLoading,
  sampleCustomersFailedCount,
  embedded,
}: SegmentExpressionLayoutProps): ReactNode {
  return (
    <div className="flex flex-col">
      {/* Expression builder: full width */}
      <div className="px-0">{expressionBuilder}</div>

      {/* Sticky preview bar */}
      <PreviewStickyBar
        preview={preview}
        loading={previewLoading}
        stale={previewStale}
        error={previewError}
        onRefresh={onRefreshPreview}
        embedded={embedded}
      />

      {/* Collapsible sections */}
      <div
        className={cn(
          "divide-border divide-y",
          embedded ? "border-border rounded-md border" : "border-border border-t"
        )}
      >
        <SampleCustomerCards
          customers={sampleCustomers}
          loading={sampleCustomersLoading}
          failedCount={sampleCustomersFailedCount}
        />
        <CompiledSqlView sql={preview?.compiledSql ?? null} />
      </div>
    </div>
  );
}

// -- Helpers --

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local[0]}***@${domain}`;
}
