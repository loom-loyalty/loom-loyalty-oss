import { Clock, Database, Download, HardDrive } from "lucide-react";
import { useState, type ReactNode } from "react";

import { DataTable, type Column } from "../data-display/data-table";

export interface QueryResultsTableProps {
  /** Column metadata from TinyBird response */
  columns: Array<{ name: string; type: string }>;
  /** Row data */
  rows: Array<Record<string, unknown>>;
  /** Total rows before limit was applied */
  totalRows?: number;
  /** Whether the auto-LIMIT was applied */
  limitApplied?: boolean;
  /** Query execution statistics */
  statistics?: {
    elapsed: number;
    rows_read: number;
    bytes_read: number;
  };
  /** Called when user clicks export CSV */
  onExportCsv?: () => void;
  /** Whether CSV export is in progress */
  isExporting?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${String(bytes)} B`;
}

function formatElapsed(seconds: number): string {
  if (seconds < 0.001) return "<1ms";
  if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
  return `${seconds.toFixed(2)}s`;
}

function CellValue({ value }: { value: unknown }): ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground/50 whitespace-nowrap italic">NULL</span>;
  }
  if (typeof value === "object") {
    return (
      <span className="text-muted-foreground max-w-xs truncate whitespace-nowrap">
        {JSON.stringify(value)}
      </span>
    );
  }
  return <span className="font-mono text-sm whitespace-nowrap">{String(value)}</span>;
}

/** Columns excluded from display — internal tenant isolation fields */
const HIDDEN_COLUMNS = new Set(["organization_id", "organization_environment_id"]);

const PAGE_SIZE = 100;

/**
 * Dynamic results table for SQL query output.
 * Wraps the shared DataTable component with dynamic columns from TinyBird response metadata.
 */
export function QueryResultsTable({
  columns,
  rows,
  totalRows,
  limitApplied,
  statistics,
  onExportCsv,
  isExporting,
}: QueryResultsTableProps): ReactNode {
  const [page, setPage] = useState(1);

  // Filter out internal columns
  const visibleColumns = columns.filter((col) => !HIDDEN_COLUMNS.has(col.name));

  // Build DataTable column definitions from TinyBird meta
  const tableColumns: Column<Record<string, unknown>>[] = visibleColumns.map((col) => ({
    key: col.name,
    header: col.name,
    render: (row: Record<string, unknown>) => <CellValue value={row[col.name]} />,
  }));

  // Client-side pagination
  const pageData = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-0">
      {/* Info bar above table */}
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-3">
          <span className="text-foreground text-sm font-medium">
            {rows.length === 0 ? "No results" : `${String(rows.length)} rows`}
          </span>
          {limitApplied && (
            <span className="bg-accent/10 text-muted-foreground rounded-md px-2 py-0.5 text-xs">
              Default limit applied — add LIMIT to your query to change
            </span>
          )}
        </div>
        {onExportCsv && rows.length > 0 && (
          <button
            type="button"
            onClick={onExportCsv}
            disabled={isExporting}
            className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {isExporting ? "Exporting…" : "Export CSV"}
          </button>
        )}
      </div>

      {/* DataTable */}
      <DataTable
        columns={tableColumns}
        data={pageData}
        getRowKey={(_, index) => String((page - 1) * PAGE_SIZE + index)}
        pagination={
          rows.length > PAGE_SIZE
            ? { page, pageSize: PAGE_SIZE, total: rows.length, onPageChange: setPage }
            : undefined
        }
        emptyMessage={
          <div className="flex flex-col items-center justify-center gap-2 py-4">
            <Database className="text-muted-foreground/30 h-8 w-8" aria-hidden="true" />
            <p className="text-muted-foreground text-sm">
              {totalRows === 0 ? "Query returned no results" : "Run a query to see results"}
            </p>
          </div>
        }
      />

      {/* Stats bar */}
      {statistics && (
        <div className="flex items-center gap-4 px-1 pt-2">
          <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {formatElapsed(statistics.elapsed)}
          </span>
          <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
            <Database className="h-3 w-3" aria-hidden="true" />
            {statistics.rows_read.toLocaleString()} rows read
          </span>
          <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
            <HardDrive className="h-3 w-3" aria-hidden="true" />
            {formatBytes(statistics.bytes_read)}
          </span>
        </div>
      )}
    </div>
  );
}
