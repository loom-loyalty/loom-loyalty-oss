import { useCallback, useRef, useState } from "react";
import { useTinybird } from "../provider";
import type { TinybirdResponse } from "../types";

export interface SqlQueryState {
  /** Query result data (dynamic columns) */
  data: TinybirdResponse<Record<string, unknown>> | null;
  /** Whether a query is currently executing */
  isLoading: boolean;
  /** Whether a CSV export is in progress */
  isExporting: boolean;
  /** Error message if the query failed */
  error: string | null;
  /** The SQL that produced the current result */
  executedSql: string | null;
}

const DEFAULT_LIMIT = 1000;
const MAX_EXPORT_ROWS = 100_000;

function hasLimit(sql: string): boolean {
  return sql.toUpperCase().includes("LIMIT");
}

function appendLimit(sql: string, limit: number): string {
  return `${sql.trimEnd()}\nLIMIT ${String(limit)}`;
}

export function useSqlQuery(): SqlQueryState & {
  runQuery: (sql: string) => Promise<void>;
  exportCsv: (sql: string, filename?: string) => Promise<void>;
} {
  const { token, baseUrl } = useTinybird();
  const [state, setState] = useState<SqlQueryState>({
    data: null,
    isLoading: false,
    isExporting: false,
    error: null,
    executedSql: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const runQuery = useCallback(
    async (sql: string) => {
      if (!token || !baseUrl) return;
      const trimmed = sql.trim();
      if (!trimmed) return;

      // Cancel any in-flight query
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Auto-append LIMIT and FORMAT JSON (TinyBird SQL defaults to NDJSON)
      const limited = hasLimit(trimmed) ? trimmed : appendLimit(trimmed, DEFAULT_LIMIT);
      const finalSql = limited.toUpperCase().includes("FORMAT ")
        ? limited
        : `${limited.replace(/;\s*$/, "")}\nFORMAT JSON`;

      setState({
        data: null,
        isLoading: true,
        isExporting: false,
        error: null,
        executedSql: finalSql,
      });

      try {
        const response = await fetch(`${baseUrl}/v0/sql`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "text/plain",
          },
          body: finalSql,
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.text();
          let message: string;
          if (response.status === 400) {
            message = body || "Query syntax error";
          } else if (response.status === 403) {
            message = "You don't have access to this datasource.";
          } else if (response.status === 429) {
            message = "Too many queries. Wait a moment and try again.";
          } else if (response.status === 408) {
            message = "Query took too long. Try adding LIMIT or narrowing your date range.";
          } else {
            message = `Query failed (${String(response.status)})`;
          }
          setState((prev) => ({ ...prev, isLoading: false, error: message }));
          return;
        }

        // User-authored SQL: skip the alias-prefix normalization that pipe hooks apply,
        // since dot-notation is legal here (e.g. SELECT c.foo AS "c.foo").
        const result = (await response.json()) as TinybirdResponse<Record<string, unknown>>;
        setState({
          data: result,
          isLoading: false,
          isExporting: false,
          error: null,
          executedSql: finalSql,
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Query failed";
        setState((prev) => ({ ...prev, isLoading: false, error: message }));
      }
    },
    [token, baseUrl]
  );

  const exportCsv = useCallback(
    async (sql: string, filename?: string) => {
      if (!token || !baseUrl) return;
      const trimmed = sql.trim();
      if (!trimmed) return;

      // For export, use original query with a safety cap
      const exportSql = hasLimit(trimmed) ? trimmed : appendLimit(trimmed, MAX_EXPORT_ROWS);

      setState((prev) => ({ ...prev, isExporting: true }));
      try {
        const response = await fetch(`${baseUrl}/v0/sql`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "text/plain",
          },
          body: `${exportSql.replace(/;\s*$/, "")}\nFORMAT CSVWithNames`,
        });

        if (!response.ok) throw new Error(`Export failed (${String(response.status)})`);

        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = filename ?? "spindle-export.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        setState((prev) => ({ ...prev, isExporting: false }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Export failed";
        setState((prev) => ({ ...prev, isExporting: false, error: message }));
      }
    },
    [token, baseUrl]
  );

  return { ...state, runQuery, exportCsv };
}
