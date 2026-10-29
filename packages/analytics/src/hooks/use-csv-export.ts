import { useCallback, useRef, useState } from "react";
import type { PipeName, PipeParams } from "../pipes";
import { useTinybird } from "../provider";
import type { ExportState } from "../types";
import { buildQueryParams } from "../utils";

export function useCsvExport(): ExportState & {
  exportCsv: <P extends PipeName>(
    pipe: P,
    params: PipeParams[P],
    filename?: string
  ) => Promise<void>;
} {
  const { token, baseUrl } = useTinybird();
  const [state, setState] = useState<ExportState>({
    isExporting: false,
    pipeName: null,
    error: null,
  });
  const busyRef = useRef(false);

  const exportCsv = useCallback(
    async <P extends PipeName>(pipe: P, params: PipeParams[P], filename?: string) => {
      if (!token || !baseUrl || busyRef.current) return;
      busyRef.current = true;
      setState({ isExporting: true, pipeName: pipe, error: null });
      try {
        const queryString = buildQueryParams(params as Record<string, unknown>);
        const url = `${baseUrl}/v0/pipes/${pipe}.csvwithnames${queryString ? `?${queryString}` : ""}`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`Export failed: ${String(response.status)}`);
        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = filename || `${pipe}-export.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        setState({ isExporting: false, pipeName: null, error: null });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Export failed";
        setState({ isExporting: false, pipeName: null, error: message });
      } finally {
        busyRef.current = false;
      }
    },
    [token, baseUrl]
  );

  return { ...state, exportCsv };
}
