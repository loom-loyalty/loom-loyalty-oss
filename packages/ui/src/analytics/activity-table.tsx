import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { ChartContainer } from "./chart-container";

interface ActivityRow {
  source_event_datetime: string;
  event_type_code: string;
  entity_type: string;
  entity_id: string;
  status: string;
  description: string;
}

interface ActivityTableProps {
  title: string;
  data: ActivityRow[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  onExport?: () => void;
  isExporting?: boolean;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

// Tinybird returns ClickHouse-format UTC timestamps "YYYY-MM-DD HH:MM:SS"
// which Safari rejects and Chrome reads as local time. Coerce to ISO + Z.
function parseActivityTimestamp(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const isoLike = raw.includes("T") ? raw : raw.replace(" ", "T");
  const withTz = /[+-]\d{2}:?\d{2}$|Z$/.test(isoLike) ? isoLike : `${isoLike}Z`;
  const d = new Date(withTz);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Real api_customer_activity statuses are uppercase (PROCESSED, FAILED, etc.);
// keep lowercase aliases for sample data and any legacy callers.
function StatusBadge({ status }: { status: string }): ReactNode {
  const colorMap: Record<string, string> = {
    success: "bg-success/10 text-success-dark",
    completed: "bg-success/10 text-success-dark",
    processed: "bg-success/10 text-success-dark",
    failed: "bg-destructive/10 text-destructive",
    error: "bg-destructive/10 text-destructive",
    rejected: "bg-destructive/10 text-destructive",
    pending: "bg-warning/10 text-warning",
    processing: "bg-info/10 text-info",
  };
  const colorClass = colorMap[status.toLowerCase()] || "bg-muted text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colorClass
      )}
    >
      {status}
    </span>
  );
}

export function ActivityTable({
  title,
  data,
  isLoading,
  error,
  onRetry,
  onExport,
  isExporting,
  page = 0,
  pageSize = 20,
  total,
  onPageChange,
  className,
}: ActivityTableProps): ReactNode {
  const totalPages = total ? Math.ceil(total / pageSize) : 1;

  return (
    <ChartContainer
      title={title}
      isLoading={isLoading}
      error={error}
      isEmpty={data.length === 0}
      onRetry={onRetry}
      onExport={onExport}
      isExporting={isExporting}
      className={className}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border border-b">
              <th scope="col" className="text-muted-foreground pb-2 text-left font-medium">
                Time
              </th>
              <th scope="col" className="text-muted-foreground pb-2 text-left font-medium">
                Event
              </th>
              <th scope="col" className="text-muted-foreground pb-2 text-left font-medium">
                Entity
              </th>
              <th scope="col" className="text-muted-foreground pb-2 text-left font-medium">
                Status
              </th>
              <th scope="col" className="text-muted-foreground pb-2 text-left font-medium">
                Description
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => {
              const parsed = parseActivityTimestamp(row.source_event_datetime);
              return (
                <tr
                  key={`${row.source_event_datetime}-${String(i)}`}
                  className="border-border/50 border-b last:border-0"
                >
                  <td className="text-muted-foreground py-2 pr-4 whitespace-nowrap">
                    {parsed ? (
                      <time dateTime={parsed.toISOString()}>
                        {parsed.toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    ) : (
                      <span aria-label="Unknown time">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                      {row.event_type_code}
                    </code>
                  </td>
                  <td className="text-muted-foreground py-2 pr-4">
                    <span>{row.entity_type}</span>
                    <span className="text-muted-foreground ml-1 text-xs">
                      {row.entity_id?.slice(0, 8) ?? "—"}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="text-muted-foreground max-w-[200px] truncate py-2">
                    {row.description}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {onPageChange && totalPages > 1 && (
        <div className="border-border mt-4 flex items-center justify-between border-t pt-4">
          <p className="text-muted-foreground text-xs">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="border-border hover:bg-muted rounded-md border px-3 py-1.5 text-xs disabled:opacity-50"
              disabled={page === 0}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="border-border hover:bg-muted rounded-md border px-3 py-1.5 text-xs disabled:opacity-50"
              disabled={page >= totalPages - 1}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </ChartContainer>
  );
}
