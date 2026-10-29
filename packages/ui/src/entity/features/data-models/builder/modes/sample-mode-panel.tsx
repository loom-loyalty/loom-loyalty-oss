/**
 * SampleModePanel
 *
 * File-based input: drop a CSV of real data, or load the canned Stripe sample.
 * Presentational only. CSV and sample parsing stay in the orchestration layer,
 * which receives the raw `File` or the load-sample signal.
 */

import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "../../../../../primitives/button.js";
import { Dropzone } from "../../../../../primitives/dropzone.js";
import type { SampleModePanelProps } from "../types.js";

const CSV_ACCEPT = { "text/csv": [".csv"] };
const MAX_BYTES = 2 * 1024 * 1024;

export function SampleModePanel({
  onFileSelected,
  onFileRejected,
  onLoadSample,
  processing = false,
  stageLabel,
  sourceSummary,
  disabled = false,
}: SampleModePanelProps): ReactNode {
  return (
    <div className="space-y-3">
      <Dropzone
        label="Drop a CSV of your data"
        description="Or click to choose a .csv file (max 2 MB)"
        accept={CSV_ACCEPT}
        maxSize={MAX_BYTES}
        processing={processing}
        stageLabel={stageLabel}
        disabled={disabled}
        className="min-h-[132px] p-4"
        onDrop={(accepted, rejected) => {
          if (rejected.length > 0) {
            const code = rejected[0]?.errors[0]?.code;
            onFileRejected?.(
              code === "file-too-large"
                ? "That file is over the 2 MB limit. Split it into smaller CSVs."
                : code === "file-invalid-type"
                  ? "Only .csv files are supported."
                  : "That file was rejected. Use a .csv under 2 MB."
            );
            return;
          }
          const file = accepted[0];
          if (file) onFileSelected(file);
        }}
      />
      <p className="text-muted-foreground text-xs">
        The column names and a few sample values per column ground the draft.
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={onLoadSample}
        disabled={disabled || processing}
        className="w-full flex-shrink-0"
      >
        <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
        Load Stripe sample
      </Button>
      {sourceSummary ? (
        <p className="text-muted-foreground flex-shrink-0 text-xs" role="status">
          {sourceSummary}
        </p>
      ) : null}
    </div>
  );
}
